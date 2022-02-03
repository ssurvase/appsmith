import React, { memo, useCallback, useEffect, useMemo } from "react";
import store, { useSelector } from "store";
import WidgetFactory from "utils/WidgetFactory";
import log from "loglevel";
import * as Sentry from "@sentry/react";
import { DSLWidget } from "widgets/constants";

import CanvasMultiPointerArena, {
  POINTERS_CANVAS_ID,
} from "../common/CanvasArenas/CanvasMultiPointerArena";
import { throttle } from "lodash";
import { RenderModes } from "constants/WidgetConstants";
import { isMultiplayerEnabledForUser as isMultiplayerEnabledForUserSelector } from "selectors/appCollabSelectors";
import { useDispatch } from "react-redux";
import { initPageLevelSocketConnection } from "actions/websocketActions";
import { collabShareUserPointerEvent } from "actions/appCollabActions";
import { getIsPageLevelSocketConnected } from "../../selectors/websocketSelectors";
import { getCurrentGitBranch } from "selectors/gitSyncSelectors";
import { getSelectedAppTheme } from "selectors/appThemingSelectors";
import { getPageLevelSocketRoomId } from "sagas/WebsocketSagas/utils";
import { previewModeSelector } from "selectors/editorSelectors";

interface CanvasProps {
  dsl: DSLWidget;
  pageId: string;
}

type PointerEventDataType = {
  data: { x: number; y: number };
  user: any;
};

const getPointerData = (
  e: any,
  pageId: string,
  isWebsocketConnected: boolean,
  currentGitBranch?: string,
) => {
  if (store.getState().ui.appCollab.editors.length < 2 || !isWebsocketConnected)
    return;
  const selectionCanvas: any = document.getElementById(POINTERS_CANVAS_ID);
  const rect = selectionCanvas.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return {
    data: { x, y },
    pageId: getPageLevelSocketRoomId(pageId, currentGitBranch),
  };
};

const useShareMousePointerEvent = () => {
  const dispatch = useDispatch();
  const isWebsocketConnected = useSelector(getIsPageLevelSocketConnected);
  useEffect(() => {
    if (!isWebsocketConnected) {
      dispatch(initPageLevelSocketConnection());
    }
  }, [isWebsocketConnected]);

  return (pointerData: PointerEventDataType) =>
    dispatch(collabShareUserPointerEvent(pointerData));
};

// TODO(abhinav): get the render mode from context
const Canvas = memo((props: CanvasProps) => {
  const { pageId } = props;
  const isPreviewMode = useSelector(previewModeSelector);
  const selectedTheme = useSelector(getSelectedAppTheme);

  const shareMousePointer = useShareMousePointerEvent();
  const isWebsocketConnected = useSelector(getIsPageLevelSocketConnected);
  const currentGitBranch = useSelector(getCurrentGitBranch);
  const isMultiplayerEnabledForUser = useSelector(
    isMultiplayerEnabledForUserSelector,
  );
  const delayedShareMousePointer = useCallback(
    throttle((data) => shareMousePointer(data), 50, {
      trailing: false,
    }),
    [shareMousePointer, pageId],
  );

  /**
   * background for canvas
   */
  const backgroundForCanvas = useMemo(() => {
    if (isPreviewMode) return "initial";

    return selectedTheme.properties.colors.backgroundColor;
  }, [selectedTheme]);

  try {
    return (
      <div
        className="relative mx-auto t--canvas-artboard pb-52"
        data-testid="t--canvas-artboard"
        id="art-board"
        onMouseMove={(e) => {
          if (!isMultiplayerEnabledForUser) return;
          const data = getPointerData(
            e,
            pageId,
            isWebsocketConnected,
            currentGitBranch,
          );
          !!data && delayedShareMousePointer(data);
        }}
        style={{
          width: props.dsl.rightColumn,
          background: backgroundForCanvas,
        }}
      >
        {props.dsl.widgetId &&
          WidgetFactory.createWidget(props.dsl, RenderModes.CANVAS)}
        {isMultiplayerEnabledForUser && (
          <CanvasMultiPointerArena pageId={pageId} />
        )}
      </div>
    );
  } catch (error) {
    log.error("Error rendering DSL", error);
    Sentry.captureException(error);
    return null;
  }
});

Canvas.displayName = "Canvas";

export default Canvas;
