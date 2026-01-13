// LoaderProvider.jsx
import React, { createContext, useState, useContext } from 'react';
import Loader from '../components/Loader/Loader';

const LoaderContext = createContext();

const LoaderProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('Загрузка...');

  const showLoader = (message = 'Загрузка...') => {
    setText(message);
    setLoading(true);
  };

  const hideLoader = () => setLoading(false);

  return (
    <LoaderContext.Provider value={{ showLoader, hideLoader }}>
      {children}
      {loading && <Loader text={text} />}
    </LoaderContext.Provider>
  );
};

export const useLoader = () => useContext(LoaderContext);

export default LoaderProvider;

