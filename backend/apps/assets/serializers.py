from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    PhysicalAsset, AssetUsageHistory, MaintenanceContract,
    AssetMaintenance, MaintenanceRecord, IntangibleAsset
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class PhysicalAssetSerializer(serializers.ModelSerializer):
    asset_type_display = serializers.CharField(source='get_asset_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    current_user_info = UserSerializer(source='current_user', read_only=True)
    purchase_contract_name = serializers.CharField(source='purchase_contract.title', read_only=True)
    
    class Meta:
        model = PhysicalAsset
        fields = '__all__'


class AssetUsageHistorySerializer(serializers.ModelSerializer):
    user_info = UserSerializer(source='user', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    
    class Meta:
        model = AssetUsageHistory
        fields = '__all__'


class MaintenanceContractSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    contract_name = serializers.CharField(source='contract.title', read_only=True)
    
    class Meta:
        model = MaintenanceContract
        fields = '__all__'


class AssetMaintenanceSerializer(serializers.ModelSerializer):
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    contract_name = serializers.CharField(source='maintenance_contract.name', read_only=True)
    
    class Meta:
        model = AssetMaintenance
        fields = '__all__'


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    record_type_display = serializers.CharField(source='get_record_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    contract_name = serializers.CharField(source='maintenance_contract.name', read_only=True)
    
    class Meta:
        model = MaintenanceRecord
        fields = '__all__'


class IntangibleAssetSerializer(serializers.ModelSerializer):
    asset_type_display = serializers.CharField(source='get_asset_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = IntangibleAsset
        fields = '__all__'
