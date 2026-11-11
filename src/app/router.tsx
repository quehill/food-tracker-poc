import { createHashRouter, Navigate } from 'react-router-dom';
import { AddScreen } from '../ui/screens/AddScreen';
import { FoodEditScreen } from '../ui/screens/FoodEditScreen';
import { FoodsScreen } from '../ui/screens/FoodsScreen';
import { MealsScreen } from '../ui/screens/MealsScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { TodayScreen } from '../ui/screens/TodayScreen';
import { AppLayout } from './AppLayout';

// Hash routing: GitHub Pages has no SPA rewrites, so deep links must live after "#".
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'add', element: <AddScreen /> },
      { path: 'foods', element: <FoodsScreen /> },
      { path: 'foods/new', element: <FoodEditScreen /> },
      { path: 'foods/:id', element: <FoodEditScreen /> },
      { path: 'meals', element: <MealsScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
