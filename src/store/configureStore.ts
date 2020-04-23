import { Middleware, Reducer, Store, applyMiddleware, createStore } from 'redux';
import { loggingMiddleware, reduceCompoundActions } from 'redoodle';
import thunk from 'redux-thunk';

import { IAppState, appReducer, initialAppState } from './app';

export function configureStore(): Store<IAppState> {
  const reducer = reduceCompoundActions(appReducer);
  const enhancer = applyMiddleware(
    thunk,
    loggingMiddleware({
      ignore: [],
    }) as Middleware
  );
  const createStoreWithMiddleware = enhancer(createStore);

  const store = createStoreWithMiddleware(reducer as Reducer<IAppState>, {
    ...initialAppState,
  });

  return store;
}
