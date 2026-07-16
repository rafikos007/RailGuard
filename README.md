# Railway Defect Detection Dashboard

This project contains a railway defect detection system with:

- a FastAPI backend for authentication, defect management, reporting, and image upload;
- a React/Vite frontend dashboard;
- a PyQt desktop detection interface that uses YOLO models.

## Repository Notes

Large/generated files are intentionally excluded from Git:

- `frontend/node_modules/`
- `backend/venv/`
- local databases such as `backend/railways.db`
- generated images in `backend/images/` and `detection_interface_app/static/`
- datasets and model weights such as `Dataset.zip`, `Models/`, and `*.pt`
- private environment files such as `backend/.env`

If you want to publish trained model weights, use GitHub Releases, cloud storage, or Git LFS instead of committing them directly.

## Backend Setup

```bash
python -m venv backend/venv
backend/venv/Scripts/activate
pip install -r requirements.txt
copy backend/.env.example backend/.env
cd backend
python seed_admin.py
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Default local admin account created by `seed_admin.py`:

- username: `admin`
- password: `admin123`

Change this before using the app outside local development.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and expects the backend at `http://localhost:8000`.

## Desktop Detection Interface

After installing the Python requirements and placing the required YOLO model files locally, run:

```bash
python detection_interface_app/detection_interface.py
```

## Start Both Web Servers

On Windows, you can use:

```bat
start_app.bat
```

## Before Publishing to GitHub

Run:

```bash
git status --short
git add .
git commit -m "Initial project cleanup for GitHub"
```

Then create a GitHub repository and follow GitHub's instructions to add the remote and push.
