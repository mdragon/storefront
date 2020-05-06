import { CompoundAction } from 'redoodle';
import { IAppState } from '../store/app';
import { IDonationSummary, IOrderSummary } from '../common/types';
import {
  SetContent,
  SetInventory,
  SetLanguages,
  SetPickupLocations,
  SetSchedules,
  SetStripePromise,
  SetTaxRate,
} from '../store/cms';
import { SetSelectedLocation } from '../store/cart';
import { Store } from 'redux';

export class AirtableService {
  public static store: Store<IAppState>;
  public static instance: AirtableService;

  public static init(store: Store) {
    this.instance = new AirtableService(store);
    AirtableService.fetchRecords();
  }

  private static fetchRecords() {
    fetch('/.netlify/functions/get-cms')
      .then((res) => res.json())
      .then((records: Record<string, any>) => {
        if (!records) return;

        if (!records.config) {
          console.error('Config not defined');
          return;
        }

        const actions: any = [
          SetContent.create(records.content),
          SetInventory.create(records.inventory),
          SetSchedules.create(records.schedules),
          SetPickupLocations.create(records.pickupLocations),
          // config
          SetLanguages.create(records.config.languages),
          SetTaxRate.create(records.config.tax_rate),
          SetStripePromise.create({
            main: records.config.stripe_main_public_api_key,
            donation: records.config.stripe_donation_public_api_key,
          }),
        ];

        if (records.pickupLocations.length === 1) {
          actions.push(SetSelectedLocation.create(records.pickupLocations[0].id));
        }

        AirtableService.store.dispatch(CompoundAction(actions));
      });
  }

  public static async createOrder(order: IOrderSummary) {
    return fetch('/.netlify/functions/create-order', {
      method: 'POST', // or 'PUT'
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    }).then((res) => res.json());
  }

  public static async createDonation(order: IDonationSummary) {
    return fetch('/.netlify/functions/create-donation', {
      method: 'POST', // or 'PUT'
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    }).then((res) => res.json());
  }

  private constructor(store: Store) {
    AirtableService.instance = this;
    AirtableService.store = store;
  }
}
