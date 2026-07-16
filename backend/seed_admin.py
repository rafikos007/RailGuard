import hashlib
from database import engine, SessionLocal, Base
import models

# Créer les tables si elles n'existent pas (init railways.db)
Base.metadata.create_all(bind=engine)

def seed_admin():
    db = SessionLocal()
    # Vérifier si l'admin existe déjà
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        # On utilise le même hachage que dans auth.py
        hashed_pw = hashlib.sha256("admin123".encode('utf-8')).hexdigest()
        new_admin = models.User(
            username="admin",
            hashed_password=hashed_pw,
            role="admin",
            region="Alger"
        )
        db.add(new_admin)
        db.commit()
        print("Compte Administrateur 'admin' créé avec succès !")
    else:
        print("Le compte Administrateur existe déjà.")
    db.close()

if __name__ == "__main__":
    seed_admin()
