from rest_framework import serializers
from .models import SystemMetrics, ActivityLog, VMMetricHistory, AlertRule, AlertHistory
from apps.information_systems.serializers import VirtualMachineSerializer

class SystemMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemMetrics
        fields = '__all__'

class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)
    resource_type_display = serializers.CharField(source='get_resource_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = '__all__'

class VMMetricHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = VMMetricHistory
        fields = '__all__'

class AlertRuleSerializer(serializers.ModelSerializer):
    virtual_machine_name = serializers.CharField(source='virtual_machine.name', read_only=True)
    
    class Meta:
        model = AlertRule
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class AlertHistorySerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source='rule.name', read_only=True)
    virtual_machine_name = serializers.CharField(source='virtual_machine.name', read_only=True)
    
    class Meta:
        model = AlertHistory
        fields = '__all__'
        read_only_fields = ['started_at', 'resolved_at']
