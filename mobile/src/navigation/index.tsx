import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Settings } from 'lucide-react-native';
import { useAuthStore } from '../store/useAuthStore';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type GroupsStackParamList = {
  GroupsList: undefined;
  GroupDetail: { groupId: number; groupName: string };
  AddExpense: { groupId: number; groupName: string; members: Array<{ id: number; name: string }> };
};

export type MainTabsParamList = {
  Dashboard: undefined;
  GroupsStack: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const GroupsStack = createNativeStackNavigator<GroupsStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabsParamList>();

function GroupsStackNavigator() {
  return (
    <GroupsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#10B981' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <GroupsStack.Screen
        name="GroupsList"
        component={GroupsScreen}
        options={{ title: 'Gruppi' }}
      />
      <GroupsStack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
      <GroupsStack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ title: 'Aggiungi spesa' }}
      />
    </GroupsStack.Navigator>
  );
}

function MainTabsNavigator() {
  return (
    <MainTabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: { backgroundColor: '#10B981' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <MainTabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <MainTabs.Screen
        name="GroupsStack"
        component={GroupsStackNavigator}
        options={{
          title: 'Gruppi',
          tabBarLabel: 'Gruppi',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <MainTabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Impostazioni',
          tabBarLabel: 'Impostazioni',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </MainTabs.Navigator>
  );
}

export default function Navigation() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <MainTabsNavigator />
      ) : (
        <AuthStack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
