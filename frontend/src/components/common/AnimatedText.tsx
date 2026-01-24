import { useState, useEffect } from 'react';
import styles from '../styles/AnimatedText.module.css';

interface AnimatedTextProps {
  text: string;
  delay: number;
}

const AnimatedText = ({ text, delay }: AnimatedTextProps) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);

      return () => clearTimeout(timeout);
    } else {
      const resetTimeout = setTimeout(() => {
        setCurrentText('');
        setCurrentIndex(0);
      }, 2000);

      return () => clearTimeout(resetTimeout);
    }
  }, [currentIndex, delay, text]);

  return (
    <span>
      {currentText}
      <span className={styles.cursor}></span>
    </span>
  );
};

export default AnimatedText;

