import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { Provider, connect} from 'react-redux'
import path from 'path'

import { ipcRenderer } from 'electron'
import KeyHandler from './../KeyHandler'
import CameraPanelInspector from './../CameraPanelInspector'
import CamerasInspector from './../CamerasInspector'
import SceneManagerR3fLarge from '../../SceneManagerR3fLarge'
import SceneManagerR3fSmall from '../../SceneManagerR3fSmall'
import Toolbar from './../Toolbar'
import FatalErrorBoundary from './../FatalErrorBoundary'

import {useExportToGltf} from '../../../hooks/use-export-to-gltf'

import useComponentSize from './../../../hooks/use-component-size'

import {Canvas, useFrame, useThree} from 'react-three-fiber'

import BonesHelper from '../../../xr/src/three/BonesHelper'
import {
  selectObject,
  setMainViewCamera,
} from './../../../shared/reducers/shot-generator'

import notifications from './../../../window/notifications'
import Icon from "../Icon";
import MenuManager from "../MenuManager";
import ElementsPanel from "../ElementsPanel";
import BoardInspector from "../BoardInspector";
import GuidesInspector from "../GuidesInspector";
import GuidesView from "../GuidesView"
import {useAsset, cleanUpCache} from '../../hooks/use-assets-manager'

import {OutlineEffect} from './../../../vendor/OutlineEffect'

import Stats from 'stats.js'

const Effect = ({renderData, stats}) => {
  const {gl, size} = useThree()

  const outlineEffect = new OutlineEffect(gl, { defaultThickness: 0.015 })
  
  useEffect(() => void outlineEffect.setSize(size.width, size.height), [size])
  useFrame(({ gl, scene, camera }) => {
    if(stats) stats.begin()
    if(renderData) {
      outlineEffect.render(renderData.scene, renderData.camera)
    } else {
      outlineEffect.render(scene, camera)
    }
    if(stats) stats.end()
  }, 1)
  
  return null
}

const Editor = React.memo(({
  mainViewCamera, aspectRatio, setMainViewCamera, withState, store, sceneObjects, world
}) => {
  const notificationsRef = useRef(null)
  const mainViewContainerRef = useRef(null)
  const largeCanvasInfo = useRef({ width: 0, height: 0 })

  const largeCanvasSize = useComponentSize(mainViewContainerRef)
  const stats = useRef()

  const setStats = (event, value) => {
    if (!stats.current) {
      stats.current = new Stats()
      stats.current.showPanel(0)
      document.body.appendChild( stats.current.dom )
      stats.current.dom.style.top = '7px'
      stats.current.dom.style.left = '460px'
    } else {
      document.body.removeChild( stats.current.dom )
      stats.current = undefined
    }
  }

  useEffect(() => {
    ipcRenderer.on('shot-generator:menu:view:fps-meter', setStats)
    return () => {
      ipcRenderer.off('shot-generator:menu:view:fps-meter', setStats)
    }
  }, [])

  /** Resources loading end */
  useEffect(() => {
    if (notificationsRef.current) {
      notifications.init(notificationsRef.current, true)
    }
  }, [notificationsRef.current])
  
  useEffect(() => {
    cleanUpCache()
    return () => {
      cleanUpCache()
    }
  }, [])

  const guidesDimensions = useMemo(() => {
    return {
      width: Math.ceil((largeCanvasSize.width || window.innerWidth)),
      height: Math.ceil((largeCanvasSize.width  || window.innerWidth) / aspectRatio)
    }
  }, [largeCanvasSize.width, largeCanvasSize.height, aspectRatio])

  const onSwapCameraViewsClick = useCallback((event) => {
    event.preventDefault()
    setMainViewCamera(mainViewCamera === 'ortho' ? 'live' : 'ortho')
    selectObject(null)
  }, [mainViewCamera])
  
  const {asset} = useAsset(path.join(window.__dirname, 'data', 'shot-generator', 'dummies', 'bone.glb'))
  const boneGltf = asset
  useMemo(() => {
    if(!boneGltf) return
    const mesh = boneGltf.scene.children.find(child => child.isMesh)
    if(mesh)
        BonesHelper.getInstance(mesh)
  }, [boneGltf])

  useMemo(() => {
    if(!largeCanvasSize.width || !largeCanvasSize.height || !aspectRatio) return
    let width = Math.ceil(largeCanvasSize.width)
    // assign a target height, based on scene aspect ratio
    let height = Math.ceil(width / aspectRatio)
    
    if (height > largeCanvasSize.height) {
      height = Math.ceil(largeCanvasSize.height)
      width = Math.ceil(height * aspectRatio)
    }
    largeCanvasInfo.current.width = width 
    largeCanvasInfo.current.height = height 
  }, [largeCanvasSize.width, largeCanvasSize.height, aspectRatio])

  const largeCanvasData = useRef({})
  const setLargeCanvasData = (camera, scene, gl) => {
    largeCanvasData.current.camera = camera
    largeCanvasData.current.scene = scene
    largeCanvasData.current.gl = gl
  }

  const smallCanvasData = useRef({})
  const setSmallCanvasData = (camera, scene, gl) => {
    smallCanvasData.current.camera = camera
    smallCanvasData.current.scene = scene
    smallCanvasData.current.gl = gl
  }


  useExportToGltf(largeCanvasData.current.scene)

  return (
    <FatalErrorBoundary>
      <div id="root">
        <Toolbar
          withState={withState}
          ipcRenderer={ipcRenderer}
          notifications={notifications}
        />
        <div id="main">
          <div id="aside">

            <div id="topdown">
            <Canvas
                key="top-down-canvas"
                id="top-down-canvas"
                tabIndex={0}
                gl2={true}
                orthographic={ true }
                updateDefaultCamera={ false }>
                <Provider store={ store }>
                  <SceneManagerR3fSmall
                    renderData={ mainViewCamera === "live" ? null : largeCanvasData.current }
                    setSmallCanvasData={ setSmallCanvasData }
                    />
                </Provider>
                <Effect renderData={ mainViewCamera === "live" ? null : largeCanvasData.current }/>
              </Canvas>
              <div className="topdown__controls">
                <div className="row"/>
                <div className="row">
                  <a href='#' onClick={onSwapCameraViewsClick}>
                    <Icon src='icon-camera-view-expand'/>
                  </a>
                </div>
              </div>
            </div>

            <div id="elements">
              <ElementsPanel/>
            </div>
          </div>

          <div className="column fill">
            <div id="camera-view" ref={ mainViewContainerRef }>
              <div id="camera-view-view" style={{ width: largeCanvasInfo.current.width, height: largeCanvasInfo.current.height }}>
                  <Canvas
                  tabIndex={ 1 }
                  key="camera-canvas"
                  id="camera-canvas"
                  gl2={true}
                  updateDefaultCamera={ true }>
                    <Provider store={ store }>
                      <SceneManagerR3fLarge
                      renderData={ mainViewCamera === "live" ? null : smallCanvasData.current }
                      setLargeCanvasData= { setLargeCanvasData }/>
                    </Provider>
                    <Effect renderData={ mainViewCamera === "live" ? null : smallCanvasData.current }
                          stats={ stats.current } />
                    
                  </Canvas>
                  <GuidesView
                    dimensions={guidesDimensions}
                  />
              </div>
            </div>
            <div className="inspectors">
              <CameraPanelInspector/>
              <BoardInspector/>
              <div>
                <CamerasInspector/>
                <GuidesInspector/>
              </div>
            </div>
          </div>
        </div>
      </div>
      <KeyHandler/>
      <MenuManager/>

      <div
        className="notifications"
        ref={notificationsRef}
      />
    </FatalErrorBoundary>
  )
})

const withState = (fn) => (dispatch, getState) => fn(dispatch, getState())
export default connect(
  (state) => ({
    mainViewCamera: state.mainViewCamera,
    aspectRatio: state.aspectRatio
  }),
  {
    withState,
    setMainViewCamera,
    selectObject,
  }
)(Editor)
