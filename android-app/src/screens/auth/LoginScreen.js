// LoginScreen.js - 移动端用户登录/注册页面
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppButton from '../../components/AppButton';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT } from '../../utils/constants';

export default function LoginScreen({ navigation }) {
  const { mobileLogin, mobileRegister } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    // 手机号校验
    if (!phone.trim()) {
      Alert.alert('提示', '请输入手机号');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      Alert.alert('提示', '手机号格式不正确');
      return;
    }
    if (!password) {
      Alert.alert('提示', '请输入密码');
      return;
    }
    if (password.length < 8 || password.length > 32) {
      Alert.alert('提示', '密码长度需8-32位');
      return;
    }
    if (!isRegister) {
      if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
        Alert.alert('提示', '密码需至少包含字母和数字');
        return;
      }
    } else {
      // 注册模式：确认密码
      if (password !== confirmPassword) {
        Alert.alert('提示', '两次输入的密码不一致');
        return;
      }
      if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
        Alert.alert('提示', '密码需至少包含字母和数字');
        return;
      }
    }

    setLoading(true);
    try {
      let result;
      if (isRegister) {
        result = await mobileRegister(phone.trim(), password);
      } else {
        result = await mobileLogin(phone.trim(), password);
      }

      // 根据角色导航
      const role = result.userInfo?.role;
      if (role === 'agent') {
        navigation.reset({ index: 0, routes: [{ name: 'AgentDashboard' }] });
      } else if (role === 'service_provider') {
        navigation.reset({ index: 0, routes: [{ name: 'SpDashboard' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }
    } catch (err) {
      if (err.message && err.message.includes('未注册')) {
        Alert.alert('提示', '该手机号尚未注册，是否立即注册？', [
          { text: '取消', style: 'cancel' },
          { text: '去注册', onPress: () => setIsRegister(true) },
        ]);
      } else {
        Alert.alert('提示', err.message || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeView>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo 区域 */}
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Ionicons name="leaf" size={48} color={COLORS.WHITE} />
            </View>
            <Text style={styles.appName}>快乐AI饮食健康积分系统</Text>
            <Text style={styles.subtitle}>健康饮食积分系统</Text>
          </View>

          {/* 登录/注册表单 */}
          <View style={styles.form}>
            <Text style={styles.title}>{isRegister ? '注册账号' : '登录'}</Text>

            <Text style={styles.label}>手机号</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入手机号"
              placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              keyboardType="phone-pad"
              maxLength={11}
              returnKeyType="next"
            />

            <Text style={styles.label}>密码</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, styles.pwdInput]}
                placeholder={isRegister ? '请设置密码（8-32位）' : '请输入密码'}
                placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                returnKeyType={isRegister ? 'next' : 'done'}
                onSubmitEditing={isRegister ? undefined : handleAuth}
              />
              <Ionicons
                name={showPwd ? 'eye-off' : 'eye'}
                size={24}
                color={COLORS.TEXT_SECONDARY}
                onPress={() => setShowPwd(!showPwd)}
                style={styles.eyeIcon}
              />
            </View>

            {isRegister && (
              <>
                <Text style={styles.label}>确认密码</Text>
                <View style={styles.pwdRow}>
                  <TextInput
                    style={[styles.input, styles.pwdInput]}
                    placeholder="请再次输入密码"
                    placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPwd}
                    returnKeyType="done"
                    onSubmitEditing={handleAuth}
                  />
                </View>
              </>
            )}

            <AppButton
              title={isRegister ? '注 册' : '登 录'}
              onPress={handleAuth}
              loading={loading}
              style={styles.authBtn}
            />

            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => {
                setIsRegister(!isRegister);
                setPassword('');
                setConfirmPassword('');
              }}
            >
              <Text style={styles.switchText}>
                {isRegister ? '已有账号？去登录' : '暂无账号？立即注册'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.termsLink}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <Text style={styles.termsText}>
                登录/注册即表示同意《用户协议》和《隐私政策》
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT.BODY,
    color: COLORS.TEXT_SECONDARY,
  },
  form: { width: '100%' },
  title: {
    fontSize: FONT.TITLE,
    fontWeight: '700',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: FONT.BODY,
    fontWeight: '500',
    color: COLORS.TEXT,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: FONT.BODY,
    color: COLORS.TEXT,
    backgroundColor: COLORS.WHITE,
  },
  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pwdInput: { flex: 1 },
  eyeIcon: { marginLeft: -40, padding: 8 },
  authBtn: { marginTop: 32 },
  switchBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: FONT.SMALL,
    color: COLORS.PRIMARY,
  },
  termsLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  termsText: {
    fontSize: FONT.SMALL,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: FONT.SMALL * 1.8,
    textDecorationLine: 'underline',
  },
});

