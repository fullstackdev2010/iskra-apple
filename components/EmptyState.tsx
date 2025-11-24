// components/EmptyState.tsx
import { View, Text, Image } from 'react-native'
import React from 'react'

import {images} from '../constants'
import CustomButton from './CustomButton'
import { router } from 'expo-router'

interface EmptyStateProps {
  title: string;
  subtitle: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, subtitle }) => {
  return (
    <View className='justify-center items-center px-4'>
      <Image
        source={images.empty}
        className="w-[270] h-[215px]" style={{ width: '70%', maxWidth: 320, aspectRatio: 270 / 215 }}
        resizeMode='contain'
      />
      <Text className='text-xl text-center font-psemibold text-white mt-2'>{title}</Text> 
      <Text className='text-md text-center font-pmedium text-gray-100'>{subtitle}</Text>
      <CustomButton
        title="Категории"
        handlePress={() => router.push('/home')}
        containerStyles='w-full mt-10 border-4 border-red-700'
        textStyles='text-xl'
      />      
    </View>
  )
}

export default EmptyState