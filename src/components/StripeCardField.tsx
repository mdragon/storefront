import { CardElement } from '@stripe/react-stripe-js';
import { StripeCardElementOptions } from '@stripe/stripe-js';
import { Typography } from '@material-ui/core';
import React from 'react';
import classNames from 'classnames';
import styles from './StripeCardField.module.scss';
import theme from '../common/theme';

const cardOptions: StripeCardElementOptions = {
  style: {
    base: {
      iconColor: 'rgba(0, 0, 0, 0.87)',
      color: 'rgba(0, 0, 0, 0.87)',
      fontFamily: '"Inter", Roboto, Open Sans, Segoe UI, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: 'rgba(0, 0, 0, 0.38)',
      },
    },
    empty: {
      iconColor: 'rgba(0, 0, 0, 0.38)',
    },
    invalid: {
      color: '#f44336',
    },
  },
};

interface Props {
  errorMessage?: string;
  className?: string;
}

const StripeCardField: React.FC<Props> = ({ errorMessage, className }) => {
  return (
    <>
      <div
        className={classNames(styles.container, className)}
        style={{ borderColor: errorMessage ? theme.palette.error.main : undefined }}
      >
        <CardElement options={cardOptions} />
      </div>
      {errorMessage && (
        <Typography variant="body2" color="error" className={styles.errorMessage}>
          {errorMessage}
        </Typography>
      )}
    </>
  );
};

export default StripeCardField;
