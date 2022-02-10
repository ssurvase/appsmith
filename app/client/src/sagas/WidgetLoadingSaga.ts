import { DependencyMap } from "../utils/DynamicBindingUtils";
import { call, fork, put, select, take, TakeEffect } from "redux-saga/effects";
import {
  getEvaluationInverseDependencyMap,
  getDataTree,
} from "../selectors/dataTreeSelectors";
import { DataTree, ENTITY_TYPE } from "entities/DataTree/dataTreeFactory";
import { getActions } from "../selectors/entitiesSelector";
import {
  ActionData,
  ActionDataState,
} from "../reducers/entityReducers/actionsReducer";
import {
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "../constants/ReduxActionConstants";
import log from "loglevel";
import * as Sentry from "@sentry/react";
import { cloneDeep, get } from "lodash";
import _ from "lodash";
import { isAction } from "workers/evaluationUtils";

// const globalLoadingActions = new Set<string>();
const activeActionChains: Record<string, Set<string>> = {};

const createEntityDependencyMap = (dependencyMap: DependencyMap) => {
  const entityDepMap: DependencyMap = {};
  Object.entries(dependencyMap).forEach(([dependant, dependencies]) => {
    const entityDependant = dependant.split(".")[0];
    const existing = entityDepMap[entityDependant] || [];
    entityDepMap[entityDependant] = existing.concat(
      dependencies
        .map((dep) => {
          const value = dep.split(".")[0];
          if (value !== entityDependant) {
            return value;
          }
          return undefined;
        })
        .filter((value) => typeof value === "string") as string[],
    );
  });
  return entityDepMap;
};

const getEntityDependencies = (
  dataTree: DataTree,
  entityNames: string[],
  inverseMap: DependencyMap,
  visited: Set<string>,
): DataTree => {
  const dependantsEntities: DataTree = {};
  entityNames.forEach((entityName) => {
    if (entityName in inverseMap) {
      inverseMap[entityName].forEach((dependency) => {
        const dependantEntityName = dependency.split(".")[0];
        // Example: For a dependency chain that looks like Dropdown1.selectedOptionValue -> Table1.tableData -> Text1.text -> Dropdown1.options
        // Here we're operating on
        // Dropdown1 -> Table1 -> Text1 -> Dropdown1
        // It looks like a circle, but isn't
        // So we need to mark the visited nodes and avoid infinite recursion in case we've already visited a node once.
        if (visited.has(dependantEntityName)) {
          return;
        }
        visited.add(dependantEntityName);
        Object.assign(dependantsEntities, {
          [dependantEntityName]: dataTree[dependantEntityName],
        });
        const childDependencies = getEntityDependencies(
          dataTree,
          Object.keys(dependantsEntities),
          inverseMap,
          visited,
        );
        Object.assign(dependantsEntities, childDependencies);
      });
    }
  });
  return dependantsEntities;
};

const ACTION_EXECUTION_REDUX_ACTIONS = [
  // Actions
  ReduxActionTypes.RUN_ACTION_REQUEST,
  ReduxActionTypes.RUN_ACTION_SUCCESS,
  ReduxActionTypes.EXECUTE_PLUGIN_ACTION_REQUEST,
  ReduxActionTypes.EXECUTE_PLUGIN_ACTION_SUCCESS,
  ReduxActionErrorTypes.EXECUTE_PLUGIN_ACTION_ERROR,
  // Widget evalution
  ReduxActionTypes.SET_EVALUATED_TREE,
];

function* setWidgetsLoadingSaga(takeEffect: TakeEffect) {
  // get all widgets evaluted data
  const dataTree: DataTree = yield select(getDataTree);
  const actions: ActionDataState = yield select(getActions);
  // const actionNames = actions.map((action) => action.config.name);
  const inverseMap = yield select(getEvaluationInverseDependencyMap);
  const entityDependencyMap = createEntityDependencyMap(inverseMap);
  let action: ActionData | undefined;

  switch (takeEffect.type) {
    case ReduxActionTypes.EXECUTE_PLUGIN_ACTION_REQUEST:
      action = actions.find(
        (a) => a.config.id === get(takeEffect.payload, "id"),
      );
      if (action) {
        // bad convention for splitting name and id
        const actionNameId = action.config.name + "-" + action.config.id;
        const dependantEntities = getEntityDependencies(
          dataTree,
          [action.config.name],
          entityDependencyMap,
          new Set<string>(),
        );
        // console.log("Hello", dependantEntities);
        const actionChain = new Set(
          Object.entries(dependantEntities)
            .filter(([, entity]) => isAction(entity))
            .map(
              ([name, entity]) => name + "-" + get(entity, ["actionId"], ""),
            ),
        );
        actionChain.add(actionNameId);
        _.set(activeActionChains, actionNameId, actionChain);
      }
      break;

    case ReduxActionTypes.EXECUTE_PLUGIN_ACTION_SUCCESS:
    case ReduxActionErrorTypes.EXECUTE_PLUGIN_ACTION_ERROR:
      action = actions.find(
        (a) => a.config.id === get(takeEffect.payload, "id"),
      );
      if (action) {
        for (const chainName in activeActionChains) {
          const actionChain = get(activeActionChains, chainName);
          if (actionChain.has(action.config.name + "-" + action.config.id)) {
            actionChain.delete(action.config.name + "-" + action.config.id);
            actionChain.size === 0 && delete activeActionChains[chainName];
          }
        }
      }
      break;

    case ReduxActionTypes.SET_EVALUATED_TREE:
      break;
    case ReduxActionTypes.RUN_ACTION_REQUEST:
      break;
    case ReduxActionTypes.RUN_ACTION_SUCCESS:
      break;
    default:
      break;
  }

  const activeChainDependantEnitites = getEntityDependencies(
    dataTree,
    Object.keys(activeActionChains).map((name) => name.split("-")[0]),
    entityDependencyMap,
    new Set<string>(),
  );

  const loadingEntites = new Set<string>();
  // check animateLoading is active on current widgets and set
  Object.entries(activeChainDependantEnitites).forEach(
    ([entityName, entity]) => {
      if ("ENTITY_TYPE" in entity && entity.ENTITY_TYPE === ENTITY_TYPE.WIDGET)
        if (get(dataTree, [entityName, "animateLoading"]) === true) {
          loadingEntites.add(entityName);
        }
    },
  );

  console.log("Hello REDUX", takeEffect.type);

  console.log("Hello ACTION_CHAIN", cloneDeep(activeActionChains));

  console.log(
    "hello DEPENDANT_ENTITES",
    Object.keys(activeChainDependantEnitites),
  );

  console.log("hello LOADING_ENTITES", loadingEntites);
  console.log("hello ----------------------------");

  yield put({
    type: ReduxActionTypes.SET_LOADING_ENTITIES,
    payload: loadingEntites,
  });
}

function* actionExecutionChangeListenerSaga() {
  while (true) {
    const takeEffect: TakeEffect = yield take(ACTION_EXECUTION_REDUX_ACTIONS);
    yield fork(setWidgetsLoadingSaga, takeEffect);
  }
}

export default function* actionExecutionChangeListeners() {
  yield take(ReduxActionTypes.START_EVALUATION);
  while (true) {
    try {
      yield call(actionExecutionChangeListenerSaga);
    } catch (e) {
      log.error(e);
      Sentry.captureException(e);
    }
  }
}
