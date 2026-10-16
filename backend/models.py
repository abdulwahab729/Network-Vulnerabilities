from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Network(Base):
    """Saved network targets (IPs / CIDR ranges / domains)."""
    __tablename__ = "networks"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)               # friendly label
    target     = Column(String, nullable=False, index=True)   # IP / domain / CIDR
    created_at = Column(DateTime, default=datetime.utcnow)

    scans = relationship("Scan", back_populates="network")


class Scan(Base):
    __tablename__ = "scans"

    id           = Column(Integer, primary_key=True, index=True)
    target       = Column(String, index=True)
    network_id   = Column(Integer, ForeignKey("networks.id"), nullable=True)
    status       = Column(String, default="pending")   # pending | in_progress | completed | failed
    created_at   = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    network         = relationship("Network", back_populates="scans")
    vulnerabilities = relationship("Vulnerability", back_populates="scan")


class Vulnerability(Base):
    __tablename__ = "vulnerabilities"

    id                 = Column(Integer, primary_key=True, index=True)
    scan_id            = Column(Integer, ForeignKey("scans.id"))
    port               = Column(Integer, nullable=True)
    protocol           = Column(String, nullable=True, default="tcp")
    service_name       = Column(String, nullable=True)
    cve_id             = Column(String, index=True, nullable=True)
    description        = Column(String, nullable=True)
    severity           = Column(String, nullable=True)      # Low | Medium | High | Critical
    risk_score         = Column(Float, nullable=True)       # 0.0 – 10.0 CVSS-like
    remediation        = Column(String, nullable=True)      # remediation advice
    remediation_status = Column(String, default="open")     # open | in_progress | resolved | verified
    verified_at        = Column(DateTime, nullable=True)    # set when status → verified

    scan = relationship("Scan", back_populates="vulnerabilities")


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role          = Column(String, default="analyst")   # admin | analyst | viewer

class Alert(Base):
    __tablename__ = "alerts"

    id         = Column(Integer, primary_key=True, index=True)
    message    = Column(String, nullable=False)
    scan_id    = Column(Integer, ForeignKey("scans.id"), nullable=True)
    is_read    = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    scan = relationship("Scan")

class ScanSchedule(Base):
    __tablename__ = "scan_schedules"

    id         = Column(Integer, primary_key=True, index=True)
    target     = Column(String, nullable=False)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=True)
    interval_hours = Column(Integer, default=24)
    next_run   = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    network = relationship("Network")
