from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/debug')
def debug():
    return render_template('debug.html')

# Serve JSON and CSV files from root/static
@app.route('/<filename>.json')
@app.route('/<filename>.csv')
def serve_data_files(filename):
    ext = '.json' if filename.endswith('.json') else '.csv'
    if not filename.endswith(ext):
        filename = filename + ext
    # Try static folder first
    static_path = os.path.join('static', filename)
    if os.path.exists(static_path):
        return send_from_directory('static', filename)
    # Fallback to root
    return send_from_directory('.', filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
