import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/ui';
import { fontFor, useColors } from '../../theme';

// Bottom tabs (SRS §40.6). Role-specific tabs (Indents, Receive, Sales, ...) arrive with their
// features; Home and More are common to every role.
export default function TabsLayout() {
  const { t } = useTranslation();
  const colors = useColors();
  const locale = useUiStore((s) => s.locale);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors['text-primary'],
        tabBarInactiveTintColor: colors['text-secondary'],
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFor(locale, 'medium').fontFamily, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tabs.more'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
