from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import models
from database import engine, SessionLocal
from scanner import run_nmap_scan, match_cves
from datetime import datetime, timedelta
import threading
import jwt
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import os
import csv
import io
import time
# ── Initialise DB tables ──────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'super-secret-vulnerability-key-123')
CORS(app)

# ── Auth decorator ─────────────────────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token or not token.startswith("Bearer "):
            return jsonify({'message': 'Token is missing or invalid!'}), 401
        token = token.split(" ")[1]
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            db = SessionLocal()
            current_user = db.query(models.User).filter_by(id=data['user_id']).first()
            db.close()
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except Exception:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ── Background scan worker ─────────────────────────────────────────────────────
def background_scan_task(scan_id: int, target: str):
    db = SessionLocal()
    scan_record = None
    try:
        scan_record = db.query(models.Scan).filter(models.Scan.id == scan_id).first()
        if not scan_record:
            return

        raw_results = run_nmap_scan(target)

        for res in raw_results:
            cve_info = match_cves(res['service_name'])
            vuln = models.Vulnerability(
                scan_id            = scan_id,
                port               = res['port'],
                protocol           = res.get('protocol', 'tcp'),
                service_name       = res['service_name'],
                description        = res['description'],
                cve_id             = cve_info['cve_id'],
                severity           = cve_info['severity'],
                risk_score         = cve_info['risk_score'],
                remediation        = cve_info.get('remediation', ''),
                remediation_status = 'open',
            )
            db.add(vuln)
            
            if cve_info.get('severity') == 'Critical':
                alert = models.Alert(
                    message=f"Critical vulnerability {cve_info['cve_id']} found on {target} port {res['port']}",
                    scan_id=scan_id
                )
                db.add(alert)

        scan_record.status       = "completed"
        scan_record.completed_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        print(f"[Scan Worker Error] {e}")
        if scan_record:
            scan_record.status = "failed"
            db.commit()
    finally:
        db.close()

# ─────────────────────────────────────────────────────────────────────────────
# Root / health
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/')
def read_root():
    return jsonify({"message": "Python Network Vulnerability Scanner API", "status": "Online"})

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy", "service": "Backend API"})

# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    db   = SessionLocal()
    if db.query(models.User).filter_by(username=data.get('username')).first():
        db.close()
        return jsonify({"message": "User already exists"}), 400
    hashed = generate_password_hash(data.get('password'))
    user   = models.User(username=data.get('username'), password_hash=hashed,
                         role=data.get('role', 'analyst'))
    db.add(user)
    db.commit()
    db.close()
    return jsonify({"message": "User created successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    db   = SessionLocal()
    user = db.query(models.User).filter_by(username=data.get('username')).first()
    db.close()
    if not user or not check_password_hash(user.password_hash, data.get('password')):
        return jsonify({"message": "Invalid credentials"}), 401
    token = jwt.encode(
        {'user_id': user.id, 'role': user.role,
         'exp': datetime.utcnow() + timedelta(hours=24)},
        app.config['SECRET_KEY'], algorithm="HS256"
    )
    return jsonify({"token": token, "role": user.role, "username": user.username})

# ─────────────────────────────────────────────────────────────────────────────
# Dashboard stats
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def dashboard_stats(current_user):
    db = SessionLocal()
    total_scans     = db.query(models.Scan).count()
    completed_scans = db.query(models.Scan).filter_by(status='completed').count()
    in_progress     = db.query(models.Scan).filter_by(status='in_progress').count()

    total_vulns    = db.query(models.Vulnerability).count()
    critical_vulns = db.query(models.Vulnerability).filter_by(severity='Critical').count()
    high_vulns     = db.query(models.Vulnerability).filter_by(severity='High').count()
    medium_vulns   = db.query(models.Vulnerability).filter_by(severity='Medium').count()
    low_vulns      = db.query(models.Vulnerability).filter_by(severity='Low').count()
    open_vulns     = db.query(models.Vulnerability).filter_by(remediation_status='open').count()
    resolved_vulns = db.query(models.Vulnerability).filter_by(remediation_status='resolved').count()
    verified_vulns = db.query(models.Vulnerability).filter_by(remediation_status='verified').count()

    # Recent 5 scans for quick overview
    recent = db.query(models.Scan).order_by(models.Scan.created_at.desc()).limit(5).all()
    recent_list = [{
        "id": s.id, "target": s.target, "status": s.status,
        "created_at": s.created_at.isoformat() + "Z" if s.created_at else None
    } for s in recent]

    db.close()
    return jsonify({
        "scans":   {"total": total_scans, "completed": completed_scans, "in_progress": in_progress},
        "vulns":   {"total": total_vulns, "critical": critical_vulns, "high": high_vulns,
                    "medium": medium_vulns, "low": low_vulns,
                    "open": open_vulns, "resolved": resolved_vulns, "verified": verified_vulns},
        "recent_scans": recent_list
    })

# ─────────────────────────────────────────────────────────────────────────────
# Networks (saved targets)
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/networks', methods=['GET'])
@token_required
def get_networks(current_user):
    db = SessionLocal()
    nets = db.query(models.Network).order_by(models.Network.created_at.desc()).all()
    result = [{"id": n.id, "name": n.name, "target": n.target,
               "created_at": n.created_at.isoformat() + "Z"} for n in nets]
    db.close()
    return jsonify(result)

@app.route('/api/networks', methods=['POST'])
@token_required
def create_network(current_user):
    data = request.json
    name   = data.get('name', '').strip()
    target = data.get('target', '').strip()
    if not name or not target:
        return jsonify({"error": "name and target are required"}), 400
    db  = SessionLocal()
    net = models.Network(name=name, target=target)
    db.add(net)
    db.commit()
    db.refresh(net)
    result = {"id": net.id, "name": net.name, "target": net.target}
    db.close()
    return jsonify(result), 201

@app.route('/api/networks/<int:net_id>', methods=['DELETE'])
@token_required
def delete_network(current_user, net_id):
    if current_user.role not in ['admin', 'analyst']:
        return jsonify({"error": "Permission denied"}), 403
    db  = SessionLocal()
    net = db.query(models.Network).filter_by(id=net_id).first()
    if not net:
        db.close()
        return jsonify({"error": "Network not found"}), 404
    db.delete(net)
    db.commit()
    db.close()
    return jsonify({"message": "Network deleted"})

# ─────────────────────────────────────────────────────────────────────────────
# Scans
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/scans', methods=['POST'])
@token_required
def create_scan(current_user):
    if current_user.role not in ['admin', 'analyst']:
        return jsonify({"error": "Permission denied"}), 403
    data       = request.json
    target     = data.get('target', '').strip()
    network_id = data.get('network_id')   # optional
    if not target:
        return jsonify({"error": "Target IP or domain is required"}), 400

    db       = SessionLocal()
    new_scan = models.Scan(target=target, status="in_progress", network_id=network_id)
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)
    scan_id  = new_scan.id
    db.close()

    threading.Thread(target=background_scan_task, args=(scan_id, target), daemon=True).start()
    return jsonify({"message": "Scan started", "scan_id": scan_id, "target": target}), 201

@app.route('/api/scans', methods=['GET'])
@token_required
def get_scans(current_user):
    db    = SessionLocal()
    scans = db.query(models.Scan).order_by(models.Scan.created_at.desc()).all()
    result = [{
        "id":           s.id,
        "target":       s.target,
        "status":       s.status,
        "created_at":   s.created_at.isoformat() + "Z" if s.created_at else None,
        "completed_at": s.completed_at.isoformat() + "Z" if s.completed_at else None,
    } for s in scans]
    db.close()
    return jsonify(result)

@app.route('/api/scans/<int:scan_id>', methods=['GET'])
@token_required
def get_scan(current_user, scan_id):
    db   = SessionLocal()
    scan = db.query(models.Scan).filter_by(id=scan_id).first()
    if not scan:
        db.close()
        return jsonify({"error": "Scan not found"}), 404
    result = {
        "id":           scan.id,
        "target":       scan.target,
        "status":       scan.status,
        "created_at":   scan.created_at.isoformat() + "Z" if scan.created_at else None,
        "completed_at": scan.completed_at.isoformat() + "Z" if scan.completed_at else None,
        "vuln_count":   len(scan.vulnerabilities),
    }
    db.close()
    return jsonify(result)

# Re-scan / Verification trigger
@app.route('/api/scans/<int:scan_id>/rescan', methods=['POST'])
@token_required
def rescan(current_user, scan_id):
    if current_user.role not in ['admin', 'analyst']:
        return jsonify({"error": "Permission denied"}), 403
    db   = SessionLocal()
    scan = db.query(models.Scan).filter_by(id=scan_id).first()
    if not scan:
        db.close()
        return jsonify({"error": "Scan not found"}), 404

    # Create a new scan for the same target (verification pass)
    new_scan = models.Scan(target=scan.target, status="in_progress",
                           network_id=scan.network_id)
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)
    new_scan_id = new_scan.id
    db.close()

    threading.Thread(target=background_scan_task, args=(new_scan_id, scan.target), daemon=True).start()
    return jsonify({"message": "Re-scan started for verification",
                    "scan_id": new_scan_id, "target": scan.target}), 201

# ─────────────────────────────────────────────────────────────────────────────
# Vulnerabilities
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/scans/<int:scan_id>/vulnerabilities', methods=['GET'])
@token_required
def get_vulnerabilities(current_user, scan_id):
    db    = SessionLocal()
    # Sort by risk_score DESC so highest-risk appear first (Prioritized)
    vulns = (db.query(models.Vulnerability)
               .filter(models.Vulnerability.scan_id == scan_id)
               .order_by(models.Vulnerability.risk_score.desc())
               .all())
    result = [{
        "id":                 v.id,
        "port":               v.port,
        "protocol":           v.protocol,
        "service":            v.service_name,
        "description":        v.description,
        "cve_id":             v.cve_id,
        "severity":           v.severity,
        "risk_score":         v.risk_score,
        "remediation":        v.remediation,
        "remediation_status": v.remediation_status,
        "verified_at":        v.verified_at.isoformat() + "Z" if v.verified_at else None,
    } for v in vulns]
    db.close()
    return jsonify(result)

@app.route('/api/vulnerabilities/<int:vuln_id>', methods=['PATCH'])
@token_required
def update_remediation(current_user, vuln_id):
    if current_user.role not in ['admin', 'analyst']:
        return jsonify({"error": "Permission denied"}), 403
    data       = request.json
    new_status = data.get('remediation_status')
    allowed    = {'open', 'in_progress', 'resolved', 'verified'}
    if new_status not in allowed:
        return jsonify({"error": f"Status must be one of {allowed}"}), 400

    db   = SessionLocal()
    vuln = db.query(models.Vulnerability).filter(models.Vulnerability.id == vuln_id).first()
    if not vuln:
        db.close()
        return jsonify({"error": "Vulnerability not found"}), 404

    vuln.remediation_status = new_status
    if new_status == 'verified':
        vuln.verified_at = datetime.utcnow()
    db.commit()
    result = {
        "id":                 vuln.id,
        "remediation_status": vuln.remediation_status,
        "verified_at":        vuln.verified_at.isoformat() + "Z" if vuln.verified_at else None,
    }
    db.close()
    return jsonify(result)

# ─────────────────────────────────────────────────────────────────────────────
# Reports
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/scans/<int:scan_id>/report', methods=['GET'])
@token_required
def export_report(current_user, scan_id):
    db   = SessionLocal()
    scan = db.query(models.Scan).filter_by(id=scan_id).first()
    if not scan:
        db.close()
        return jsonify({"error": "Scan not found"}), 404

    vulns = (db.query(models.Vulnerability)
               .filter_by(scan_id=scan_id)
               .order_by(models.Vulnerability.risk_score.desc())
               .all())
    db.close()

    si     = io.StringIO()
    writer = csv.writer(si)
    writer.writerow(['Vuln ID', 'Port', 'Protocol', 'Service', 'CVE ID',
                     'Severity', 'Risk Score', 'Description', 'Remediation Advice',
                     'Remediation Status', 'Verified At'])
    for v in vulns:
        writer.writerow([
            v.id, v.port, v.protocol, v.service_name, v.cve_id,
            v.severity, v.risk_score, v.description, v.remediation,
            v.remediation_status,
            v.verified_at.isoformat() + "Z" if v.verified_at else ''
        ])

    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = f"attachment; filename=scan_{scan_id}_report.csv"
    output.headers["Content-type"]        = "text/csv"
    return output

# ─────────────────────────────────────────────────────────────────────────────
# Alerts & Scheduling
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/alerts', methods=['GET'])
@token_required
def get_alerts(current_user):
    db = SessionLocal()
    alerts = db.query(models.Alert).order_by(models.Alert.created_at.desc()).all()
    result = [{
        "id": a.id, "message": a.message, "scan_id": a.scan_id, "is_read": a.is_read,
        "created_at": a.created_at.isoformat() + "Z" if a.created_at else None
    } for a in alerts]
    db.close()
    return jsonify(result)

@app.route('/api/alerts/<int:alert_id>/read', methods=['POST'])
@token_required
def mark_alert_read(current_user, alert_id):
    db = SessionLocal()
    alert = db.query(models.Alert).filter_by(id=alert_id).first()
    if alert:
        alert.is_read = 1
        db.commit()
    db.close()
    return jsonify({"message": "Alert marked as read"})

@app.route('/api/schedules', methods=['GET', 'POST'])
@token_required
def manage_schedules(current_user):
    db = SessionLocal()
    if request.method == 'POST':
        if current_user.role not in ['admin', 'analyst']:
            return jsonify({"error": "Permission denied"}), 403
        data = request.json
        sched = models.ScanSchedule(
            target=data['target'],
            network_id=data.get('network_id'),
            interval_hours=data.get('interval_hours', 24)
        )
        db.add(sched)
        db.commit()
        db.refresh(sched)
        db.close()
        return jsonify({"message": "Schedule created", "id": sched.id}), 201
    else:
        schedules = db.query(models.ScanSchedule).all()
        result = [{
            "id": s.id, "target": s.target, "interval_hours": s.interval_hours,
            "next_run": s.next_run.isoformat() + "Z" if s.next_run else None
        } for s in schedules]
        db.close()
        return jsonify(result)

def scheduler_worker():
    while True:
        try:
            db = SessionLocal()
            now = datetime.utcnow()
            due = db.query(models.ScanSchedule).filter(models.ScanSchedule.next_run <= now).all()
            for sched in due:
                new_scan = models.Scan(target=sched.target, status="in_progress", network_id=sched.network_id)
                db.add(new_scan)
                db.commit()
                db.refresh(new_scan)
                threading.Thread(target=background_scan_task, args=(new_scan.id, sched.target), daemon=True).start()
                sched.next_run = now + timedelta(hours=sched.interval_hours)
                db.commit()
            db.close()
        except Exception as e:
            print(f"[Scheduler Error] {e}")
        time.sleep(60)

if __name__ == '__main__':
    threading.Thread(target=scheduler_worker, daemon=True).start()
    app.run(port=8000, debug=True)
