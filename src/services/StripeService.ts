import { AirtableService } from './AirtableService';
import { CardElement } from '@stripe/react-stripe-js';
import { CompoundAction } from 'redoodle';
import { IAppState } from '../store/app';
import {
  ICheckoutFormData,
  IDonationFormData,
  IDonationSummary,
  IOrderSummary,
  OrderStatus,
  PaymentStatus,
  PaymentType,
} from '../common/types';
import { SetConfirmation, SetDiscountCode, SetError, SetIsPaying } from '../store/checkout';
import {
  SetItems,
  discountSelector,
  requiresPaymentSelector,
  subtotalSelector,
  taxSelector,
  totalSelector,
} from '../store/cart';
import { Store } from 'redux';
import { Stripe, StripeCardElement, StripeElements } from '@stripe/stripe-js';
import { getOrderItemsForOrderIntent } from '../common/utils';
import { makeContentValueSelector, productListSelector } from '../store/cms';

export class StripeService {
  public static store: Store<IAppState>;
  public static instance: StripeService;

  public static init(store: Store) {
    this.instance = new StripeService(store);
  }

  private static async processPayment(
    paymentType: PaymentType,
    amount: number,
    stripe: Stripe,
    elements: StripeElements,
  ) {
    const errorMessage = makeContentValueSelector()(StripeService.store.getState(), 'error_payment');
    StripeService.store.dispatch(CompoundAction([SetIsPaying.create(true), SetError.create(undefined)]));
    try {
      const clientSecretResult = await fetch(
        `/.netlify/functions/stripe-payment?amountCents=${Math.round(amount * 100)}&paymentType=${paymentType}`,
      ).then((res) => res.json());

      if (!clientSecretResult || !clientSecretResult.client_secret) {
        throw new Error('Could not get client secret. Stripe public key must be added to config table in Airtable');
      }

      const result = await stripe.confirmCardPayment(clientSecretResult.client_secret, {
        payment_method: {
          card: elements.getElement(CardElement) as StripeCardElement,
        },
      });
      if (result.error || !result.paymentIntent || result.paymentIntent.status !== 'succeeded') {
        console.log('result error', result.error?.message);
        StripeService.store.dispatch(
          CompoundAction([SetError.create(result.error?.message || errorMessage), SetIsPaying.create(false)]),
        );
        return;
      }

      if (result.paymentIntent.status === 'succeeded') {
        return result.paymentIntent.id;
      }
    } catch (error) {
      console.log('Stripe payment error', error);
      StripeService.store.dispatch(CompoundAction([SetError.create(errorMessage), SetIsPaying.create(false)]));
    }
  }

  public static async pay(formData: ICheckoutFormData, stripe: Stripe | null, elements: StripeElements | null) {
    if (!stripe || !elements) return;

    const state = StripeService.store.getState();
    const subtotal = subtotalSelector(state);
    const discount = discountSelector(state);
    const tax = taxSelector(state);
    const total = totalSelector(state);
    const productList = productListSelector(state);
    const requiresPayment = requiresPaymentSelector(state);
    const discountCode = state.checkout.discountCode?.code;
    const isDonationRequest = state.checkout.isDonationRequest;
    const stockByLocation = state.cms.config.stockByLocation;

    let stripePaymentId: string | undefined;
    if (requiresPayment) {
      stripePaymentId = await StripeService.processPayment('main', total, stripe, elements);
    } else {
      StripeService.store.dispatch(SetIsPaying.create(true));
    }

    if (requiresPayment && !stripePaymentId) {
      StripeService.store.dispatch(SetError.create('Payment could not be processed.'));
      return PaymentStatus.FAILED;
    }

    const type = state.cart.orderType;
    const items = state.cart.items;

    const orderIntent = {
      ...formData,
      status: isDonationRequest
        ? OrderStatus.DONATION_REQUESTED
        : stripePaymentId
        ? OrderStatus.PAID
        : OrderStatus.PLACED,
      subsidized: isDonationRequest,
      type,
      subtotal,
      discount,
      tax,
      total,
      discountCode,
      items,
      stripePaymentId,
    };

    if (stockByLocation) {
      orderIntent.items = getOrderItemsForOrderIntent(orderIntent, productList);
    }

    const confirmation: IOrderSummary = await AirtableService.createOrder(orderIntent);

    StripeService.store.dispatch(
      CompoundAction([
        SetConfirmation.create(confirmation),
        SetIsPaying.create(false),
        SetItems.create([]),
        SetDiscountCode.create(undefined),
      ]),
    );

    return PaymentStatus.SUCCEEDED;
  }

  public static async donate(formData: IDonationFormData, stripe: Stripe | null, elements: StripeElements | null) {
    if (!stripe || !elements) return;

    const state = StripeService.store.getState();
    const amount = formData.otherAmount ? parseInt(formData.otherAmount) : state.checkout.donationAmount;
    const stripePaymentId = await StripeService.processPayment('donation', amount, stripe, elements);

    if (stripePaymentId) {
      const confirmation: IDonationSummary = await AirtableService.createDonation({
        ...formData,
        amount,
        stripePaymentId,
      });

      StripeService.store.dispatch(CompoundAction([SetConfirmation.create(confirmation), SetIsPaying.create(false)]));

      return PaymentStatus.SUCCEEDED;
    }
  }

  private constructor(store: Store) {
    StripeService.instance = this;
    StripeService.store = store;
  }
}
