from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from .models import (
    PhysicalAsset, AssetUsageHistory, MaintenanceContract,
    AssetMaintenance, MaintenanceRecord, IntangibleAsset
)
from .serializers import (
    PhysicalAssetSerializer, AssetUsageHistorySerializer,
    MaintenanceContractSerializer, AssetMaintenanceSerializer,
    MaintenanceRecordSerializer, IntangibleAssetSerializer
)


class PhysicalAssetViewSet(viewsets.ModelViewSet):
    queryset = PhysicalAsset.objects.all()
    serializer_class = PhysicalAssetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'serial_number', 'manufacturer', 'model']
    ordering_fields = ['created_at', 'name', 'purchase_date']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        asset_type = self.request.query_params.get('asset_type')
        status = self.request.query_params.get('status')
        
        if asset_type:
            queryset = queryset.filter(asset_type=asset_type)
        if status:
            queryset = queryset.filter(status=status)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        queryset = self.get_queryset()
        
        total_count = queryset.count()
        by_type = queryset.values('asset_type').annotate(count=Count('id'))
        by_status = queryset.values('status').annotate(count=Count('id'))
        
        return Response({
            'total_count': total_count,
            'by_type': list(by_type),
            'by_status': list(by_status)
        })


class AssetUsageHistoryViewSet(viewsets.ModelViewSet):
    queryset = AssetUsageHistory.objects.all()
    serializer_class = AssetUsageHistorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        asset_id = self.request.query_params.get('asset_id')
        
        if asset_id:
            queryset = queryset.filter(asset_id=asset_id)
            
        return queryset


class MaintenanceContractViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceContract.objects.all()
    serializer_class = MaintenanceContractSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'contract_number', 'vendor']
    ordering_fields = ['created_at', 'start_date', 'end_date']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get('status')
        
        if status:
            queryset = queryset.filter(status=status)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        queryset = self.get_queryset()
        
        total_count = queryset.count()
        by_status = queryset.values('status').annotate(count=Count('id'))
        
        return Response({
            'total_count': total_count,
            'by_status': list(by_status)
        })


class AssetMaintenanceViewSet(viewsets.ModelViewSet):
    queryset = AssetMaintenance.objects.all()
    serializer_class = AssetMaintenanceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        asset_id = self.request.query_params.get('asset_id')
        
        if asset_id:
            queryset = queryset.filter(asset_id=asset_id)
            
        return queryset


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.all()
    serializer_class = MaintenanceRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['asset__name', 'technician', 'description']
    ordering_fields = ['scheduled_date', 'actual_date', 'created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        asset_id = self.request.query_params.get('asset_id')
        record_type = self.request.query_params.get('record_type')
        status = self.request.query_params.get('status')
        
        if asset_id:
            queryset = queryset.filter(asset_id=asset_id)
        if record_type:
            queryset = queryset.filter(record_type=record_type)
        if status:
            queryset = queryset.filter(status=status)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        queryset = self.get_queryset()
        
        total_count = queryset.count()
        by_type = queryset.values('record_type').annotate(count=Count('id'))
        by_status = queryset.values('status').annotate(count=Count('id'))
        
        return Response({
            'total_count': total_count,
            'by_type': list(by_type),
            'by_status': list(by_status)
        })


class IntangibleAssetViewSet(viewsets.ModelViewSet):
    queryset = IntangibleAsset.objects.all()
    serializer_class = IntangibleAssetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'name', 'purchase_date']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        asset_type = self.request.query_params.get('asset_type')
        status = self.request.query_params.get('status')
        
        if asset_type:
            queryset = queryset.filter(asset_type=asset_type)
        if status:
            queryset = queryset.filter(status=status)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        queryset = self.get_queryset()
        
        total_count = queryset.count()
        by_type = queryset.values('asset_type').annotate(count=Count('id'))
        by_status = queryset.values('status').annotate(count=Count('id'))
        
        return Response({
            'total_count': total_count,
            'by_type': list(by_type),
            'by_status': list(by_status)
        })
