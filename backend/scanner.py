import nmap
import requests
import time

# ──────────────────────────────────────────────────────────────────────────────
# CVE Knowledge Base (extended local rules + optional NVD API fallback)
# ──────────────────────────────────────────────────────────────────────────────
CVE_RULES = [
    # Apache
    {"keywords": ["apache"],         "cve_id": "CVE-2021-41773", "severity": "Critical", "risk_score": 9.8,
     "remediation": "Upgrade Apache HTTP Server to 2.4.50 or later. Disable mod_cgi if not needed."},
    # Log4Shell
    {"keywords": ["log4j", "java"],  "cve_id": "CVE-2021-44228", "severity": "Critical", "risk_score": 10.0,
     "remediation": "Upgrade Log4j to 2.17.1+. Set log4j2.formatMsgNoLookups=true as a workaround."},
    # SSH weak keys
    {"keywords": ["openssh", "ssh"], "cve_id": "CVE-2023-38408", "severity": "High",     "risk_score": 8.1,
     "remediation": "Upgrade OpenSSH to 9.3p2+. Disable weak key algorithms in sshd_config."},
    # SMB EternalBlue
    {"keywords": ["smb", "netbios", "microsoft-ds"], "cve_id": "CVE-2017-0144", "severity": "Critical", "risk_score": 9.3,
     "remediation": "Apply MS17-010 patch. Disable SMBv1 via PowerShell: Set-SmbServerConfiguration -EnableSMB1Protocol $false"},
    # FTP anonymous
    {"keywords": ["ftp", "vsftpd", "proftpd"], "cve_id": "CVE-2011-2523", "severity": "High", "risk_score": 7.8,
     "remediation": "Disable anonymous FTP access. Upgrade vsftpd to 2.3.5+. Consider switching to SFTP."},
    # RDP BlueKeep
    {"keywords": ["rdp", "ms-wbt-server", "terminal"], "cve_id": "CVE-2019-0708", "severity": "Critical", "risk_score": 9.8,
     "remediation": "Apply KB4499175 patch. Enable NLA (Network Level Authentication). Block port 3389 externally."},
    # MySQL
    {"keywords": ["mysql", "mariadb"], "cve_id": "CVE-2012-2122", "severity": "High", "risk_score": 7.5,
     "remediation": "Upgrade MySQL/MariaDB. Disable remote root login. Use strong authentication plugins."},
    # Telnet (plaintext)
    {"keywords": ["telnet"],         "cve_id": "CVE-1999-0619", "severity": "High",     "risk_score": 7.0,
     "remediation": "Disable Telnet. Replace with SSH. Block port 23 at the firewall."},
    # Redis unauthenticated
    {"keywords": ["redis"],          "cve_id": "CVE-2022-0543", "severity": "Critical", "risk_score": 10.0,
     "remediation": "Enable requirepass in redis.conf. Bind to 127.0.0.1 only. Upgrade to Redis 6.2.7+."},
    # Nginx
    {"keywords": ["nginx"],          "cve_id": "CVE-2021-23017", "severity": "High",     "risk_score": 7.7,
     "remediation": "Upgrade Nginx to 1.21.0+. Review resolver configuration for off-by-one vulnerability."},
    # PHP
    {"keywords": ["php"],            "cve_id": "CVE-2021-21703", "severity": "High",     "risk_score": 7.8,
     "remediation": "Upgrade PHP to 8.0.12+ or 7.4.25+. Disable unnecessary PHP-FPM exposure."},
    # MongoDB unauthenticated
    {"keywords": ["mongodb", "mongo"], "cve_id": "CVE-2019-2390", "severity": "High",   "risk_score": 6.5,
     "remediation": "Enable MongoDB authentication. Bind to localhost only. Upgrade to 4.4+."},
    # Elasticsearch unauthenticated
    {"keywords": ["elasticsearch"],  "cve_id": "CVE-2014-3120", "severity": "Critical", "risk_score": 9.0,
     "remediation": "Enable X-Pack security. Do not expose Elasticsearch port publicly. Use a reverse proxy."},
    # DNS
    {"keywords": ["dns", "domain"],  "cve_id": "CVE-2020-1350",  "severity": "Critical", "risk_score": 10.0,
     "remediation": "Apply Windows DNS Server patch KB4569509 (SIGRed). Enable firewall rules for DNS."},
    # HTTP (generic unencrypted)
    {"keywords": ["http", "httpd"],  "cve_id": "CVE-2022-22720", "severity": "Medium",   "risk_score": 5.5,
     "remediation": "Enforce HTTPS. Upgrade to Apache 2.4.53+. Use TLS 1.2+ only."},
    # SNMP
    {"keywords": ["snmp"],           "cve_id": "CVE-2002-0013",  "severity": "Medium",   "risk_score": 6.4,
     "remediation": "Use SNMPv3 with authentication and encryption. Change default community strings."},
    # VNC
    {"keywords": ["vnc", "rfb"],     "cve_id": "CVE-2006-2369",  "severity": "High",     "risk_score": 7.5,
     "remediation": "Enable VNC authentication. Use an SSH tunnel for remote access. Restrict access by IP."},
    # SMTP
    {"keywords": ["smtp", "exim", "postfix", "sendmail"], "cve_id": "CVE-2020-28017", "severity": "Critical", "risk_score": 9.8,
     "remediation": "Upgrade Exim to 4.94.2+. Configure SMTP authentication. Disable open relay."},
    # LDAP
    {"keywords": ["ldap"],           "cve_id": "CVE-2021-4034",  "severity": "High",     "risk_score": 7.8,
     "remediation": "Patch pkexec (CVE-2021-4034). Enable LDAP signing and channel binding."},
    # Docker API exposed
    {"keywords": ["docker"],         "cve_id": "CVE-2019-5736",  "severity": "Critical", "risk_score": 8.6,
     "remediation": "Do not expose Docker API socket. Update runc. Use rootless containers."},
]


def match_cves(service_name: str) -> dict:
    """
    Match a service name against the local CVE knowledge base.
    Falls back to NVD API for unknown services if internet is available.
    """
    service_lower = service_name.lower()

    # 1. Try local rules first (fast, offline)
    for rule in CVE_RULES:
        if any(kw in service_lower for kw in rule["keywords"]):
            return {
                "cve_id":       rule["cve_id"],
                "severity":     rule["severity"],
                "risk_score":   rule["risk_score"],
                "remediation":  rule["remediation"],
            }

    # 2. Fallback: query NIST NVD API (requires internet)
    try:
        keyword = service_name.split()[0]  # use first word as search keyword
        resp = requests.get(
            "https://services.nvd.nist.gov/rest/json/cves/2.0",
            params={"keywordSearch": keyword, "resultsPerPage": 1},
            timeout=5
        )
        if resp.status_code == 200:
            items = resp.json().get("vulnerabilities", [])
            if items:
                cve = items[0]["cve"]
                cve_id = cve["id"]
                metrics = cve.get("metrics", {})
                score = 0.0
                severity = "Unknown"
                if "cvssMetricV31" in metrics:
                    cvss = metrics["cvssMetricV31"][0]["cvssData"]
                    score = cvss.get("baseScore", 0.0)
                    severity = cvss.get("baseSeverity", "Unknown").capitalize()
                elif "cvssMetricV2" in metrics:
                    cvss = metrics["cvssMetricV2"][0]["cvssData"]
                    score = cvss.get("baseScore", 0.0)
                    severity = "Medium" if score >= 4.0 else "Low"
                desc = cve.get("descriptions", [{}])[0].get("value", "")
                return {
                    "cve_id":      cve_id,
                    "severity":    severity,
                    "risk_score":  score,
                    "remediation": f"Check vendor advisory for {keyword}. {desc[:200]}",
                }
    except Exception:
        pass  # If NVD is unreachable, fall through to default

    # 3. Default: genuinely unknown service
    return {
        "cve_id":      None,
        "severity":    "Low",
        "risk_score":  1.0,
        "remediation": "Monitor this service and ensure it is intentionally exposed. Apply principle of least privilege.",
    }


def run_nmap_scan(target: str) -> list:
    """
    Performs a fast Nmap scan (-F -sV -Pn) on the target.
    Returns a list of dicts for each open port/service found.
    Requires Nmap to be installed on the host machine.
    """
    scan_results = []

    try:
        nm = nmap.PortScanner()
        nm.scan(hosts=target, arguments='-F -sV -Pn')

        for host in nm.all_hosts():
            for proto in nm[host].all_protocols():
                ports = nm[host][proto].keys()
                for port in sorted(ports):
                    port_data = nm[host][proto][port]
                    if port_data['state'] == 'open':
                        service_name = port_data.get('name', 'unknown')
                        product      = port_data.get('product', '')
                        version      = port_data.get('version', '')
                        full_service = f"{service_name} {product} {version}".strip()

                        scan_results.append({
                            "port":         port,
                            "protocol":     proto,
                            "service_name": full_service or service_name,
                            "description":  (
                                f"Open {proto.upper()} port {port} running {full_service}"
                                if full_service else f"Open {proto.upper()} port {port}"
                            )
                        })

    except nmap.PortScannerError as e:
        print(f"[Nmap Error] {e} — Is Nmap installed and on PATH?")
    except Exception as e:
        print(f"[Scan Error] {e}")


    return scan_results
