from django.db import models
from django.core.cache import cache
import json


class SystemSetting(models.Model):
    """系统设置模型"""
    category = models.CharField('分类', max_length=50, unique=True, db_index=True)
    settings_json = models.TextField('设置JSON', default='{}')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'system_settings'
        verbose_name = '系统设置'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.category} 设置'

    @property
    def settings(self):
        """获取设置字典"""
        try:
            return json.loads(self.settings_json)
        except json.JSONDecodeError:
            return {}

    @settings.setter
    def settings(self, value):
        """设置设置字典"""
        self.settings_json = json.dumps(value, ensure_ascii=False)

    def save(self, *args, **kwargs):
        """保存时清除缓存"""
        super().save(*args, **kwargs)
        cache_key = f'system_settings_{self.category}'
        cache.delete(cache_key)

    @classmethod
    def get_settings(cls, category, default=None):
        """获取指定分类的设置"""
        cache_key = f'system_settings_{category}'
        settings = cache.get(cache_key)
        
        if settings is None:
            try:
                obj = cls.objects.get(category=category)
                settings = obj.settings
                cache.set(cache_key, settings, 3600)  # 缓存1小时
            except cls.DoesNotExist:
                settings = default or {}
        
        return settings

    @classmethod
    def update_settings(cls, category, settings_dict):
        """更新指定分类的设置"""
        obj, created = cls.objects.get_or_create(category=category)
        obj.settings = settings_dict
        obj.save()
        return obj
