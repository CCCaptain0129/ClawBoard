/**
 * SyncLockService 测试
 * 
 * PMW-030: 防回环机制 - 分布式锁
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncLockService } from '../src/services/syncLockService';

describe('SyncLockService', () => {
  let lockService: SyncLockService;

  beforeEach(() => {
    lockService = new SyncLockService(5000); // 5 秒超时
  });

  afterEach(() => {
    lockService.clearAll();
  });

  describe('acquire', () => {
    it('应该成功获取锁', () => {
      const result = lockService.acquire('test-lock', 'project-1');
      
      expect(result).toBe(true);
      expect(lockService.isHeld('test-lock')).toBe(true);
    });

    it('应该阻止重复获取锁', () => {
      // 第一次获取
      const result1 = lockService.acquire('test-lock', 'project-1');
      expect(result1).toBe(true);
      
      // 第二次获取应该失败
      const result2 = lockService.acquire('test-lock', 'project-1');
      expect(result2).toBe(false);
    });

    it('应该支持不同的锁键', () => {
      const result1 = lockService.acquire('lock-1', 'project-1');
      const result2 = lockService.acquire('lock-2', 'project-1');
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(lockService.isHeld('lock-1')).toBe(true);
      expect(lockService.isHeld('lock-2')).toBe(true);
    });
  });

  describe('release', () => {
    it('应该成功释放锁', () => {
      lockService.acquire('test-lock', 'project-1');
      lockService.release('test-lock');
      
      expect(lockService.isHeld('test-lock')).toBe(false);
    });

    it('释放不存在的锁应该无害', () => {
      // 不应该抛出异常
      expect(() => lockService.release('non-existent')).not.toThrow();
    });

    it('释放后应该可以重新获取锁', () => {
      lockService.acquire('test-lock', 'project-1');
      lockService.release('test-lock');
      
      const result = lockService.acquire('test-lock', 'project-1');
      expect(result).toBe(true);
    });
  });

  describe('isHeld', () => {
    it('未获取锁时应返回 false', () => {
      expect(lockService.isHeld('test-lock')).toBe(false);
    });

    it('获取锁后应返回 true', () => {
      lockService.acquire('test-lock', 'project-1');
      expect(lockService.isHeld('test-lock')).toBe(true);
    });

    it('释放锁后应返回 false', () => {
      lockService.acquire('test-lock', 'project-1');
      lockService.release('test-lock');
      expect(lockService.isHeld('test-lock')).toBe(false);
    });
  });

  describe('超时机制', () => {
    it('锁超时后应该自动失效', async () => {
      const shortLockService = new SyncLockService(100); // 100ms 超时
      
      shortLockService.acquire('test-lock', 'project-1');
      expect(shortLockService.isHeld('test-lock')).toBe(true);
      
      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(shortLockService.isHeld('test-lock')).toBe(false);
      
      shortLockService.clearAll();
    });

    it('超时后应该可以重新获取锁', async () => {
      const shortLockService = new SyncLockService(100);
      
      shortLockService.acquire('test-lock', 'project-1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = shortLockService.acquire('test-lock', 'project-1');
      expect(result).toBe(true);
      
      shortLockService.clearAll();
    });
  });

  describe('getStatus', () => {
    it('应该返回锁的状态信息', () => {
      lockService.acquire('lock-1', 'project-1');
      lockService.acquire('lock-2', 'project-2');
      
      const status = lockService.getStatus();
      
      expect(status.totalLocks).toBe(2);
      expect(status.locks).toHaveLength(2);
      expect(status.locks.find(l => l.lockKey === 'lock-1')).toBeDefined();
      expect(status.locks.find(l => l.lockKey === 'lock-2')).toBeDefined();
    });

    it('应该包含剩余时间信息', () => {
      lockService.acquire('test-lock', 'project-1');
      
      const status = lockService.getStatus();
      const lockInfo = status.locks.find(l => l.lockKey === 'test-lock');
      
      expect(lockInfo).toBeDefined();
      expect(lockInfo!.remainingMs).toBeGreaterThan(0);
      expect(lockInfo!.projectId).toBe('project-1');
    });
  });

  describe('clearAll', () => {
    it('应该清理所有锁', () => {
      lockService.acquire('lock-1', 'project-1');
      lockService.acquire('lock-2', 'project-2');
      
      lockService.clearAll();
      
      expect(lockService.isHeld('lock-1')).toBe(false);
      expect(lockService.isHeld('lock-2')).toBe(false);
    });
  });

  describe('forceRelease', () => {
    it('应该强制释放锁', () => {
      lockService.acquire('test-lock', 'project-1');
      lockService.forceRelease('test-lock');
      
      expect(lockService.isHeld('test-lock')).toBe(false);
    });
  });
});