/**
 * SyncLockService - 同步锁服务
 *
 * PMW-030: 防回环机制 - 分布式锁
 *
 * 核心功能：
 * 1. 提供基于 projectId 的锁机制
 * 2. 支持 acquire/release 操作
 * 3. 内置超时机制（默认 5 秒）
 * 4. 防止重复同步导致的回环问题
 */

interface LockInfo {
  acquiredAt: number;
  timeoutMs: number;
  projectId: string;
}

export class SyncLockService {
  private locks: Map<string, LockInfo> = new Map();
  private defaultTimeoutMs: number = 5000; // 默认 5 秒

  constructor(defaultTimeoutMs?: number) {
    if (defaultTimeoutMs) {
      this.defaultTimeoutMs = defaultTimeoutMs;
    }
  }

  /**
   * 尝试获取锁
   *
   * @param lockKey - 锁键（通常为 projectId）
   * @param projectId - 项目ID
   * @param timeoutMs - 超时时间（毫秒），默认 5000ms
   * @returns 是否获取成功
   */
  acquire(lockKey: string, projectId: string, timeoutMs?: number): boolean {
    const timeout = timeoutMs || this.defaultTimeoutMs;
    const now = Date.now();

    // 检查是否已有锁
    const existingLock = this.locks.get(lockKey);

    // 如果锁已存在且未超时，则获取失败
    if (existingLock) {
      const isExpired = (now - existingLock.acquiredAt) > existingLock.timeoutMs;
      if (!isExpired) {
        console.log(`🔒 [SyncLock] Failed to acquire lock for ${lockKey}: already held`);
        return false;
      }
      // 锁已超时，清理
      console.log(`⏰ [SyncLock] Lock for ${lockKey} expired, cleaning up`);
      this.locks.delete(lockKey);
    }

    // 获取锁
    const lockInfo: LockInfo = {
      acquiredAt: now,
      timeoutMs: timeout,
      projectId,
    };

    this.locks.set(lockKey, lockInfo);
    console.log(`🔓 [SyncLock] Acquired lock for ${lockKey} (timeout: ${timeout}ms)`);
    return true;
  }

  /**
   * 释放锁
   *
   * @param lockKey - 锁键
   */
  release(lockKey: string): void {
    const lock = this.locks.get(lockKey);
    if (lock) {
      this.locks.delete(lockKey);
      console.log(`🔓 [SyncLock] Released lock for ${lockKey}`);
    } else {
      console.warn(`⚠️ [SyncLock] Attempted to release non-existent lock: ${lockKey}`);
    }
  }

  /**
   * 检查锁是否被持有
   *
   * @param lockKey - 锁键
   * @returns 是否被持有
   */
  isHeld(lockKey: string): boolean {
    const lock = this.locks.get(lockKey);
    if (!lock) {
      return false;
    }

    // 检查是否超时
    const now = Date.now();
    const isExpired = (now - lock.acquiredAt) > lock.timeoutMs;

    if (isExpired) {
      console.log(`⏰ [SyncLock] Lock for ${lockKey} expired during check`);
      this.locks.delete(lockKey);
      return false;
    }

    return true;
  }

  /**
   * 强制释放锁（清理超时锁）
   */
  forceRelease(lockKey: string): void {
    if (this.locks.delete(lockKey)) {
      console.log(`🔓 [SyncLock] Force released lock for ${lockKey}`);
    }
  }

  /**
   * 获取所有锁的当前状态
   */
  getStatus(): {
    totalLocks: number;
    locks: Array<{
      lockKey: string;
      projectId: string;
      acquiredAt: string;
      timeoutMs: number;
      remainingMs: number;
    }>;
  } {
    const now = Date.now();
    const locks = Array.from(this.locks.entries()).map(([lockKey, lock]) => {
      const elapsed = now - lock.acquiredAt;
      const remaining = Math.max(0, lock.timeoutMs - elapsed);

      return {
        lockKey,
        projectId: lock.projectId,
        acquiredAt: new Date(lock.acquiredAt).toISOString(),
        timeoutMs: lock.timeoutMs,
        remainingMs: remaining,
      };
    });

    return {
      totalLocks: this.locks.size,
      locks,
    };
  }

  /**
   * 清理所有锁
   */
  clearAll(): void {
    const count = this.locks.size;
    this.locks.clear();
    console.log(`🔓 [SyncLock] Cleared all ${count} locks`);
  }
}