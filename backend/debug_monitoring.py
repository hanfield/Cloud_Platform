import os
import django
import sys

# Setup Django environment
sys.path.append('/Users/hanli/Downloads/Yunpingtai/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')
django.setup()

try:
    import psutil
    print("psutil imported successfully")
except ImportError:
    print("Error: psutil not installed")

from apps.monitoring.utils import get_system_resources, get_service_status
from apps.monitoring.models import SystemMetrics

print("Testing get_system_resources...")
try:
    resources = get_system_resources()
    print(f"Resources: {resources}")
except Exception as e:
    print(f"Error in get_system_resources: {e}")

print("\nTesting get_service_status...")
try:
    services = get_service_status()
    print(f"Services: {services}")
except Exception as e:
    print(f"Error in get_service_status: {e}")

print("\nTesting SystemMetrics creation...")
try:
    metrics = SystemMetrics.objects.create(
        cpu_usage=0.0,
        memory_usage=0.0,
        disk_usage=0.0
    )
    print(f"Created metrics: {metrics}")
except Exception as e:
    print(f"Error creating SystemMetrics: {e}")
