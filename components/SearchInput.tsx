// components/SearchInput.tsx
import { View, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { icons } from '../constants';
import { router, usePathname, useLocalSearchParams } from 'expo-router';

// SIMPLE GLOBAL DEBOUNCE TIMER
let __searchTimer: any = null;

interface SearchInputProps {
  initialQuery?: string;
  catalog?: string;
  placeholder?: string;
  onChangeText?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

const SearchInput = ({ initialQuery = '', catalog, placeholder = 'поиск по выбранной категории', onChangeText, onSubmit }: SearchInputProps) => {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const [query, setQuery] = useState(initialQuery || '');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSearch = () => {
    if (!query) {
      return Alert.alert('Поиск', 'Введите строку поиска.');
    }

    if (onSubmit) {
      onSubmit(query);
      return;
    }

    const encodedQuery = encodeURIComponent(query);
    const encodedCatalog = encodeURIComponent(
      catalog ||
        (Array.isArray(params.catalog)
          ? params.catalog.join(',')
          : (params.catalog as string)) ||
        ''
    );

    const targetUrl = `/search/${encodedQuery}${encodedCatalog ? `?catalog=${encodedCatalog}` : ''}`;

    if (pathname.startsWith('/search')) {
      router.setParams({ query: encodedQuery, catalog: encodedCatalog });
    } else {
      router.push(targetUrl as any);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    
    // debounce 200ms
    clearTimeout(__searchTimer);
    __searchTimer = setTimeout(() => {
      if (onChangeText) onChangeText(text);
    }, 200);
  };

  const handleClear = () => {
    setQuery('');
    if (onChangeText) onChangeText('');
    if (onSubmit) onSubmit('');
  };;

  return (
    <View className='border-2 border-black-200 w-full h-16 px-4 bg-black-100 rounded-2xl focus:border-secondary items-center flex-row space-x-3'>
      <Image source={icons.search} className='w-5 h-5' resizeMode='contain' />

      <TextInput
        className='text-base mt-0.5 text-white flex-1 font-pregular'
        value={query}
        placeholder={placeholder}
        placeholderTextColor='#cdcde0'
        onChangeText={handleTextChange}
        onSubmitEditing={handleSearch}
        returnKeyType='search'
      />

      {query.length > 0 && (
        <TouchableOpacity onPress={handleClear}>
          <Image source={icons.close} className='w-4 h-4' resizeMode='contain' />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchInput;
