// app/(auth)/_layout.tsx
import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

const AuthLayout = () => {
  return (
    <>
      <Stack>
        <Stack.Screen
          name='sign-in'
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name='sign-up'
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name='pin-login'
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name='pin-setup'
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name='pin-reset'
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style='light' />
    </>
  )
}

export default AuthLayout
