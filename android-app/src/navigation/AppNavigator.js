import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '../utils/constants';

import { useAuth } from '../context/AuthContext';
import LoadingOverlay from '../components/LoadingOverlay';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen from '../screens/home/HomeScreen';
import HealthScreen from '../screens/health/HealthScreen';
import QuestionnaireScreen from '../screens/health/QuestionnaireScreen';
import ReportScreen from '../screens/report/ReportScreen';
import ReportDetailScreen from '../screens/report/ReportDetailScreen';
import ClockInScreen from '../screens/clockin/ClockInScreen';
import PointsScreen from '../screens/points/PointsScreen';
import SignInScreen from '../screens/points/SignInScreen';
import CourseListScreen from '../screens/points/CourseListScreen';
import CourseDetailScreen from '../screens/points/CourseDetailScreen';
import GiftListScreen from '../screens/points/GiftListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PrivacySettingsScreen from '../screens/profile/PrivacySettingsScreen';
import ReferralScreen from '../screens/profile/ReferralScreen';
import ArticlesScreen from '../screens/home/ArticlesScreen';
import ArticleDetailScreen from '../screens/home/ArticleDetailScreen';
import AgentDashboardScreen from '../screens/agent/AgentDashboardScreen';
import AgentClientsScreen from '../screens/agent/AgentClientsScreen';
import SpDashboardScreen from '../screens/provider/SpDashboardScreen';
import PrivacyPolicyScreen from '../screens/common/PrivacyPolicyScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  const { userRole } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Health') iconName = focused ? 'heart-circle' : 'heart-circle-outline';
          else if (route.name === 'ClockIn') iconName = focused ? 'camera' : 'camera-outline';
          else if (route.name === 'Points') iconName = focused ? 'trophy' : 'trophy-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.PRIMARY,
        tabBarInactiveTintColor: COLORS.TEXT_PLACEHOLDER,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: COLORS.WHITE,
          borderTopWidth: 1,
          borderTopColor: COLORS.BORDER,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '首页' }} />
      <Tab.Screen name="Health" component={HealthScreen} options={{ tabBarLabel: '健康' }} />
      <Tab.Screen name="ClockIn" component={ClockInScreen} options={{ tabBarLabel: '打卡' }} />
      <Tab.Screen name="Points" component={PointsScreen} options={{ tabBarLabel: '积分' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '我的' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { initializing, isLoggedIn, userRole } = useAuth();

  if (initializing) {
    return <LoadingOverlay message="正在启动..." />;
  }

  // 根据角色决定首页路由
  const getInitialRoute = () => {
    if (!isLoggedIn) return 'Login';
    if (userRole === 'agent') return 'AgentDashboard';
    if (userRole === 'service_provider') return 'SpDashboard';
    return 'MainTabs';
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={getInitialRoute()}
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.WHITE },
          headerTintColor: COLORS.TEXT,
          headerTitleStyle: { fontSize: FONT.TITLE, fontWeight: '600' },
          headerBackTitleVisible: false,
        }}
      >
        {/* Auth */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* Main Tabs */}
        <Stack.Screen
          name="MainTabs"
          component={HomeTabs}
          options={{ headerShown: false }}
        />

        {/* Health Stack */}
        <Stack.Screen
          name="Questionnaire"
          component={QuestionnaireScreen}
          options={{ title: '健康问卷' }}
        />
        <Stack.Screen
          name="Report"
          component={ReportScreen}
          options={{ title: '健康报告' }}
        />
        <Stack.Screen
          name="ReportDetail"
          component={ReportDetailScreen}
          options={{ title: '报告详情' }}
        />

        {/* Points Stack */}
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ title: '每日签到' }}
        />
        <Stack.Screen
          name="CourseList"
          component={CourseListScreen}
          options={{ title: '健康课程' }}
        />
        <Stack.Screen
          name="CourseDetail"
          component={CourseDetailScreen}
          options={{ title: '课程详情' }}
        />
        <Stack.Screen
          name="GiftList"
          component={GiftListScreen}
          options={{ title: '积分商城' }}
        />

        {/* Profile Stack */}
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: '编辑资料' }}
        />
        <Stack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: '隐私设置' }}
        />
        <Stack.Screen
          name="Referral"
          component={ReferralScreen}
          options={{ title: '我的推荐' }}
        />
        <Stack.Screen
          name="Articles"
          component={ArticlesScreen}
          options={{ title: '健康资讯' }}
        />
        <Stack.Screen
          name="ArticleDetail"
          component={ArticleDetailScreen}
          options={{ title: '资讯详情' }}
        />

        {/* Agent Screens */}
        <Stack.Screen
          name="AgentDashboard"
          component={AgentDashboardScreen}
          options={{ title: '代理商工作台', headerLeft: () => null }}
        />
        <Stack.Screen
          name="AgentClients"
          component={AgentClientsScreen}
          options={{ title: '名下客户' }}
        />

        {/* Service Provider Screens */}
        <Stack.Screen
          name="SpDashboard"
          component={SpDashboardScreen}
          options={{ title: '服务商工作台', headerLeft: () => null }}
        />

        {/* Common Screens */}
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ title: '隐私政策' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}