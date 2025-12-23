# AES S-Box Analysis Dashboard

Flask-based web application for analyzing AES S-boxes with visualization tools.

## Features
- Upload S-box files (Excel/CSV)
- Generate random S-boxes
- Analyze cryptographic properties
- Visualize S-box patterns
- Image encryption demo

## Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the app:
```bash
python app.py
```

3. Open browser: `http://localhost:5000`

## Deploy to Render

1. Push to GitHub:
```bash
git add .
git commit -m "Flask app ready for deployment"
git push
```

2. In Render Dashboard:
   - Connect your repository
   - Render will auto-detect `render.yaml`
   - Click "Create Web Service"

## Tech Stack
- **Backend**: Flask, Gunicorn
- **Frontend**: Vanilla JavaScript, Chart.js
- **Libraries**: SheetJS (XLSX parsing)

## Files Structure
```
├── app.py              # Flask application
├── requirements.txt    # Python dependencies
├── Procfile           # Process file for deployment
├── render.yaml        # Render configuration
├── templates/         # HTML files
│   ├── index.html
│   └── debug.html
└── static/           # CSS, JS, data files
    ├── style.css
    ├── script.js
    ├── analyzer.js
    ├── aes-visualizer.js
    ├── image-encryption.js
    ├── sample-sbox.json
    └── test-sbox.csv
```
