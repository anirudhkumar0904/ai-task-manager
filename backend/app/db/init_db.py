from sqlalchemy.orm import Session
from app.db.session import engine, Base
from app.models import user, role, task, document, activity_log  # noqa: F401 — registers models
from app.core.security import hash_password


def init_db(db: Session) -> None:
    """Create all tables and seed initial data."""
    Base.metadata.create_all(bind=engine)
    _seed_roles(db)
    _seed_admin(db)


def _seed_roles(db: Session) -> None:
    from app.models.role import Role

    for name in ("admin", "user"):
        if not db.query(Role).filter(Role.name == name).first():
            db.add(Role(name=name, description=f"System {name} role"))
    db.commit()


def _seed_admin(db: Session) -> None:
    from app.models.user import User
    from app.models.role import Role

    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if not db.query(User).filter(User.email == "admin@example.com").first():
        admin = User(
            name="System Admin",
            email="admin@example.com",
            hashed_password=hash_password("Admin@123"),
            role_id=admin_role.id,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("✅ Admin user created: admin@example.com / Admin@123")
