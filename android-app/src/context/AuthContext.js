import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // 注册全局 token 过期回调
  useEffect(() => {
    global.onTokenExpired = () => {
      setUser(null);
      setToken(null);
      storage.clearAll();
    };
    return () => { delete global.onTokenExpired; };
  }, []);

  // 初始化：检查本地是否有 Token
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await storage.getToken();
        if (savedToken) {
          // 验证 Token 有效性
          const res = await authApi.validateToken();
          if (res.success && res.data) {
            setToken(savedToken);
            setUser(res.data);
          } else {
            await storage.clearAll();
          }
        }
      } catch (err) {
        // Token 无效，清除
        await storage.clearAll();
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    })();
  }, []);

  const login = useCallback(async (account, password) => {
    const res = await authApi.webLogin(account, password);
    if (res.success && res.data) {
      await storage.saveToken(res.data.token);
      await storage.saveUser(res.data.userInfo);
      setToken(res.data.token);
      setUser(res.data.userInfo);
      return res.data;
    }
    throw new Error(res.message || '登录失败');
  }, []);

  const mobileLogin = useCallback(async (phone, password, shareCode, referrerId) => {
    const res = await authApi.mobileLogin(phone, password, shareCode, referrerId);
    if (res.success && res.data) {
      await storage.saveToken(res.data.token);
      await storage.saveUser(res.data.userInfo);
      setToken(res.data.token);
      setUser(res.data.userInfo);
      return res.data;
    }
    throw new Error(res.message || '登录失败');
  }, []);

  const mobileRegister = useCallback(async (phone, password, shareCode, referrerId) => {
    const res = await authApi.mobileRegister(phone, password, shareCode, referrerId);
    if (res.success && res.data) {
      await storage.saveToken(res.data.token);
      await storage.saveUser(res.data.userInfo);
      setToken(res.data.token);
      setUser(res.data.userInfo);
      return res.data;
    }
    throw new Error(res.message || '注册失败');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (e) { /* ignore */ }
    await storage.clearAll();
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
    storage.saveUser(userData);
  }, []);

  const isLoggedIn = !!token && !!user;
  const userRole = user?.role || user?.identityType || 'guest';
  const isAdmin = user?.role === 'admin' || user?.isSuper === true;
  const isAgent = user?.role === 'agent';
  const isProvider = user?.role === 'service_provider';
  const isMember = user?.isMember === true || user?.identityType === 'member';

  return (
    <AuthContext.Provider value={{
      user, token, loading, initializing,
      login, mobileLogin, mobileRegister, logout, updateUser,
      isLoggedIn, userRole, isAdmin, isAgent, isProvider, isMember,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}