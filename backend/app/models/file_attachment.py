from sqlalchemy import Column, String, Integer, DateTime, Text
from datetime import datetime
from app.core.database import Base
import uuid


class FileAttachment(Base):
    __tablename__ = "file_attachments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    module = Column(String(50), nullable=False, index=True)
    record_type = Column(String(100), nullable=False)
    record_id = Column(String(255), nullable=False, index=True)

    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=True)

    document_type = Column(String(100), nullable=True)

    cloudinary_public_id = Column(String(500), nullable=False)
    cloudinary_url = Column(Text, nullable=False)
    cloudinary_secure_url = Column(Text, nullable=False)

    description = Column(Text, nullable=True)
    expiry_date = Column(DateTime, nullable=True)

    uploaded_by = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "module": self.module,
            "record_type": self.record_type,
            "record_id": self.record_id,
            "file_name": self.file_name,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "document_type": self.document_type,
            "cloudinary_url": self.cloudinary_secure_url,
            "description": self.description,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "uploaded_by": self.uploaded_by,
            "uploaded_at": self.uploaded_at.isoformat(),
        }
