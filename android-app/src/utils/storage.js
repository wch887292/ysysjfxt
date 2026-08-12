// 安全存储封装（Token/用户信息持久化）
// P4-安全加固：Token 使用 expo-secure-store（Android Keystore / iOS Keychain）
// 防止设备被Root/越狱后通过文件系统直接提取Token
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = SecureStore.getItemAsync !== undefined
  ? SecureStore.ITEM_KEY
  : 'ysjfxt_token';

// 安全存储：Token 使用 SecureStore（加密存储，防止提取）
export const secureStorage = {
  async saveToken(token) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (e) {
      // 降级：SecureStore 不可用时（如模拟器）使用 AsyncStorage
      await AsyncStorage.setItem('@ysjfxt_token', token);
    }
  },
  async getToken() {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return await AsyncStorage.getItem('@ysjfxt_token');
    }
  },
  async removeToken() {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      await AsyncStorage.removeItem('@ysjfxt_token');
    }
  },
};

// 普通存储：用户信息（非敏感，使用 AsyncStorage 即可）
export const storage = {
  async saveToken(token) {
    await secureStorage.saveToken(token);
  },
  async getToken() {
    return await secureStorage.getToken();
  },
  async removeToken() {
    await secureStorage.removeToken();
  },

  async saveUser(user) {
    await AsyncStorage.setItem('@ysjfxt_user', JSON.stringify(user));
  },
  async getUser() {
    const raw = await AsyncStorage.getItem('@ysjfxt_user');
    return raw ? JSON.parse(raw) : null;
  },
  async removeUser() {
    await AsyncStorage.removeItem('@ysjfxt_user');
  },

  async clearAll() {
    await secureStorage.removeToken();
    await AsyncStorage.multiRemove(['@ysjfxt_user']);
  },
};
