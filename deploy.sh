#!/bin/bash

# Cloud Platform Deployment Script
# Target OS: CentOS 7/8 / Rocky Linux / AlmaLinux
# Usage: sudo ./deploy.sh

set -e

# Configuration
PROJECT_DIR="/opt/yunpingtai"
REPO_URL="https://github.com/hanfield/Cloud_Platform.git"
DB_NAME="cloud_platform"
DB_USER="cloud_user"
DB_PASSWORD="cloud_password_secure" # Change this!
PYTHON_VERSION="3.9.18" # Or install via yum if available

echo ">>> Starting Deployment..."

# 1. Install System Dependencies
echo ">>> Installing System Dependencies..."
yum update -y
yum install -y git wget gcc openssl-devel bzip2-devel libffi-devel zlib-devel postgresql-devel redis nginx

# Install Python 3.9 if not present (CentOS 7 often has old Python)
if ! command -v python3.9 &> /dev/null; then
    echo ">>> Installing Python 3.9..."
    yum install -y make
    cd /tmp
    wget https://www.python.org/ftp/python/$PYTHON_VERSION/Python-$PYTHON_VERSION.tgz
    tar xzf Python-$PYTHON_VERSION.tgz
    cd Python-$PYTHON_VERSION
    ./configure --enable-optimizations
    make altinstall
    ln -sf /usr/local/bin/python3.9 /usr/bin/python3
    ln -sf /usr/local/bin/pip3.9 /usr/bin/pip3
fi

# Install Node.js (for building frontend)
if ! command -v node &> /dev/null; then
    echo ">>> Installing Node.js..."
    # Try installing from default repositories first
    if ! yum install -y nodejs npm; then
        echo ">>> Node.js not found in default repos. Trying NodeSource..."
        # Try NodeSource, but don't exit on failure
        curl -fsSL https://rpm.nodesource.com/setup_16.x | bash - || echo ">>> NodeSource setup failed, attempting to install nodejs anyway..."
        yum install -y nodejs
    fi
fi

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo ">>> Installing PostgreSQL..."
    # This might vary by OS version, assuming CentOS 7/8 standard repos or pgdg
    yum install -y postgresql-server postgresql-contrib
    postgresql-setup initdb
    systemctl enable postgresql
    systemctl start postgresql
fi

# Install Redis
systemctl enable redis
systemctl start redis

# 2. Setup Database
echo ">>> Setting up Database..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || true
sudo -u postgres psql -c "ALTER ROLE $DB_USER SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE $DB_USER SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE $DB_USER SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# 3. Clone Project
if [ -d "$PROJECT_DIR" ]; then
    echo ">>> Project directory exists. Pulling latest changes..."
    cd $PROJECT_DIR
    git pull
else
    echo ">>> Cloning project..."
    git clone $REPO_URL $PROJECT_DIR
    cd $PROJECT_DIR
fi

# 4. Backend Setup
echo ">>> Setting up Backend..."
cd $PROJECT_DIR/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Configure .env
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i "s/DB_NAME=.*/DB_NAME=$DB_NAME/" .env
    sed -i "s/DB_USER=.*/DB_USER=$DB_USER/" .env
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
    sed -i "s/DB_HOST=.*/DB_HOST=localhost/" .env
    # Generate a random secret key
    SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
    sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET/" .env
fi

# Run Migrations
python manage.py migrate
python manage.py collectstatic --noinput

# 5. Frontend Setup
echo ">>> Setting up Frontend..."
cd $PROJECT_DIR/frontend
npm install
npm run build

# 6. Configure Nginx
echo ">>> Configuring Nginx..."
cat > /etc/nginx/conf.d/yunpingtai.conf <<EOF
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        root $PROJECT_DIR/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Static files (Django Admin)
    location /static/admin/ {
        alias $PROJECT_DIR/backend/staticfiles/admin/;
    }
    
    location /static/rest_framework/ {
        alias $PROJECT_DIR/backend/staticfiles/rest_framework/;
    }
}
EOF

# Remove default nginx config if it conflicts
rm -f /etc/nginx/conf.d/default.conf

# 7. Setup Systemd Services
echo ">>> Setting up Systemd Services..."

# Gunicorn Service
cat > /etc/systemd/system/gunicorn.service <<EOF
[Unit]
Description=gunicorn daemon
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PROJECT_DIR/backend/venv/bin/gunicorn --access-logfile - --workers 3 --bind 127.0.0.1:8000 cloud_platform.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

# Celery Worker Service
cat > /etc/systemd/system/celery.service <<EOF
[Unit]
Description=Celery Service
After=network.target

[Service]
Type=forking
User=root
Group=root
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PROJECT_DIR/backend/venv/bin/celery -A cloud_platform multi start worker1 \
    --pidfile=/var/run/celery/worker1.pid \
    --logfile=/var/log/celery/worker1.log \
    --loglevel=INFO
ExecStop=$PROJECT_DIR/backend/venv/bin/celery multi stopwait worker1 \
    --pidfile=/var/run/celery/worker1.pid

[Install]
WantedBy=multi-user.target
EOF

# Celery Beat Service
cat > /etc/systemd/system/celerybeat.service <<EOF
[Unit]
Description=Celery Beat Service
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$PROJECT_DIR/backend/venv/bin/celery -A cloud_platform beat \
    --pidfile=/var/run/celery/beat.pid \
    --logfile=/var/log/celery/beat.log \
    --loglevel=INFO

[Install]
WantedBy=multi-user.target
EOF

# Create log/run directories
mkdir -p /var/run/celery /var/log/celery
chmod 755 /var/run/celery /var/log/celery

# Reload and Start Services
systemctl daemon-reload
systemctl enable gunicorn celery celerybeat nginx
systemctl restart gunicorn celery celerybeat nginx

echo ">>> Deployment Complete!"
echo ">>> Access the platform at http://<YOUR_VM_IP>"
