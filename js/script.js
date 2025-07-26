THREE.VolumetericLightShader = {
    uniforms: {
      tDiffuse: { value: null },
      lightPosition: { value: new THREE.Vector2(0.5, 0.5) },
      exposure: { value: 1 },
      decay: { value: 1 },
      density: { value: 0 },
      weight: { value: 0.1 },
      samples: { value: 3 }
    },
  
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "varying vec2 vUv;",
      "uniform sampler2D tDiffuse;",
      "uniform vec2 lightPosition;",
      "uniform float exposure;",
      "uniform float decay;",
      "uniform float density;",
      "uniform float weight;",
      "uniform int samples;",
      "const int MAX_SAMPLES = 100;",
      "void main() {",
      "  vec2 texCoord = vUv;",
      "  vec2 deltaTextCoord = texCoord - lightPosition;",
      "  deltaTextCoord *= 1.0 / float(samples) * density;",
      "  vec4 color = texture2D(tDiffuse, texCoord);",
      "  float illuminationDecay = 1.0;",
      "  for(int i=0; i < MAX_SAMPLES; i++) {",
      "    if(i == samples) {",
      "      break;",
      "    }",
      "    texCoord += deltaTextCoord;",
      "    vec4 sample = texture2D(tDiffuse, texCoord);",
      "    sample *= illuminationDecay * weight;",
      "    color += sample;",
      "    illuminationDecay *= decay;",
      "  }",
      "  gl_FragColor = color * exposure;",
      "}"
    ].join("\n")
  };
  
  THREE.AdditiveBlendingShader = {
    uniforms: {
      tDiffuse: { value: null },
      tAdd: { value: null }
    },
  
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "uniform sampler2D tDiffuse;",
      "uniform sampler2D tAdd;",
      "varying vec2 vUv;",
      "void main() {",
      "  vec4 color = texture2D(tDiffuse, vUv);",
      "  vec4 add = texture2D(tAdd, vUv);",
      "  vec3 blendedColor = color.rgb + add.rgb;",
      "  float blendedAlpha = max(color.a, add.a);",
      "  gl_FragColor = vec4(blendedColor, blendedAlpha);",
      "}"
    ].join("\n")
  };
  
  THREE.PassThroughShader = {
    uniforms: {
      tDiffuse: { value: null }
    },
  
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "uniform sampler2D tDiffuse;",
      "varying vec2 vUv;",
      "void main() {",
      "  gl_FragColor = texture2D(tDiffuse, vUv);",
      "}"
    ].join("\n")
  };
  
  THREE.BlackKeyShader = {
    uniforms: {
      tDiffuse: { value: null },
      threshold: { value: 0.05 },
      thresholdEnd: { value: 0.15 }
    },
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "uniform sampler2D tDiffuse;",
      "uniform float threshold;",
      "uniform float thresholdEnd;",
      "varying vec2 vUv;",
      "void main() {",
      "  vec4 color = texture2D(tDiffuse, vUv);",
      "  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));",
      "  float alpha = smoothstep(threshold, thresholdEnd, brightness);",
      "  alpha = pow(alpha, 0.5);",
      "  gl_FragColor = vec4(color.rgb, alpha);",
      "}"
    ].join("\n")
  };
  
  const width = 400;
  const height = 500;
  const lightColor = 0x00baff;
  const DEFAULT_LAYER = 0;
  const OCCLUSION_LAYER = 1;
  const renderScale = 1;
  const clock = new THREE.Clock();
  
  let composer,
    filmPass,
    badTVPass,
    bloomPass,
    occlusionComposer,
    itemMesh,
    occMesh,
    occRenderTarget,
    lightSource,
    vlShaderUniforms,
    blackKeyPass;
  
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    premultipliedAlpha: false
  });
  
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height);
  
  document.getElementById('hologram-wrapper').appendChild(renderer.domElement);
  
  function setupScene() {
    lightSource = new THREE.Object3D();
    lightSource.position.set(0, -15, -15);
  
    const itemGeo = new THREE.PlaneGeometry(9, 8);
    const itemMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7 });
  
    const video = document.createElement('video');
    video.crossOrigin = 'Anonymous';
    video.loop = true;
    video.playsInline = true;
    video.muted = true;
    video.volume = 1.0;
  
    // Add flag to track first play
    let isFirstLoop = true;
    
    // Use timeupdate to check for loop completion
    video.addEventListener('timeupdate', () => {
      if (video.currentTime < video.duration * 0.1 && !isFirstLoop) {
        video.pause();  // Pause instead of muting
        video.currentTime = 0;  // Reset to first frame
      }
    });
  
    // Create initial preview with muted video
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
  
    itemMaterial.map = videoTexture;
    itemMaterial.needsUpdate = true;
  
    const occItemMaterial = new THREE.MeshBasicMaterial({ color: lightColor });
    occItemMaterial.map = videoTexture;
    occItemMaterial.needsUpdate = true;
  
    itemMesh = new THREE.Mesh(itemGeo, itemMaterial);
    scene.add(itemMesh);
  
    occMesh = new THREE.Mesh(itemGeo, occItemMaterial);
    occMesh.layers.set(OCCLUSION_LAYER);
    scene.add(occMesh);
  
    // Start with muted preview
    video.src = 'test.mp4';
    video.load();
    video.play().catch(e => {
      console.log("Preview autoplay prevented:", e);
    });
  
    function changeVideo(src) {
      video.pause();
      video.src = src;
      video.load();
      video.muted = false;  // Start unmuted
      isFirstLoop = true;   // Reset first loop flag
      
      video.play().catch(e => {
        console.log("Autoplay prevented:", e);
      });

      // Set up one-time listener for first loop completion
      const checkFirstLoop = () => {
        if (video.currentTime >= video.duration * 0.95) {
          isFirstLoop = false;
          video.removeEventListener('timeupdate', checkFirstLoop);
        }
      };
      video.addEventListener('timeupdate', checkFirstLoop);
    }
  
    const playVideoWithAudio = (src) => {
      changeVideo(src);
    };
  
    document.getElementById('holo1').addEventListener('click', () => playVideoWithAudio('test.mp4'));
    document.getElementById('holo2').addEventListener('click', () => playVideoWithAudio('test2.mp4'));
    document.getElementById('holo3').addEventListener('click', () => playVideoWithAudio('test3.mp4'));
    document.getElementById('holo4').addEventListener('click', () => playVideoWithAudio('test4.mp4'));
    document.getElementById('holo5').addEventListener('click', () => playVideoWithAudio('test5.mp4'));
    document.getElementById('holo6').addEventListener('click', () => playVideoWithAudio('test6.mp4'));
    document.getElementById('holo7').addEventListener('click', () => playVideoWithAudio('test7.mp4'));
    document.getElementById('holo8').addEventListener('click', () => playVideoWithAudio('test8.mp4'));
    document.getElementById('holox1').addEventListener('click', () => playVideoWithAudio('test.mp4'));
    document.getElementById('holox2').addEventListener('click', () => playVideoWithAudio('test2.mp4'));
    document.getElementById('holox3').addEventListener('click', () => playVideoWithAudio('test3.mp4'));
    document.getElementById('holox4').addEventListener('click', () => playVideoWithAudio('test4.mp4'));
    document.getElementById('holox5').addEventListener('click', () => playVideoWithAudio('test5.mp4'));
    document.getElementById('holox6').addEventListener('click', () => playVideoWithAudio('test6.mp4'));
    document.getElementById('holox7').addEventListener('click', () => playVideoWithAudio('test7.mp4'));
    document.getElementById('holox8').addEventListener('click', () => playVideoWithAudio('test8.mp4'));
  
    setInterval(() => {
      if (window.innerWidth < 768) {
        camera.position.z = 6.7;
      } else {
        camera.position.z = 5;
      }
    }, 1000);
  
    // Add function to handle first interaction
    const handleFirstInteraction = () => {
      // Remove the listener since we only need it once
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        document.getElementById('holo1').click();
        document.getElementById('holox1').click();
      }, 100);
    };
  
    // Add listeners for first interaction
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
  }
  
  function setupPostprocessing() {
    occRenderTarget = new THREE.WebGLRenderTarget(width * renderScale, height * renderScale, {
      format: THREE.RGBAFormat,
      transparent: true,
      alpha: true,
      premultipliedAlpha: false
    });
  
    const hBlur = new THREE.ShaderPass(THREE.HorizontalBlurShader);
    const vBlur = new THREE.ShaderPass(THREE.VerticalBlurShader);
    const bluriness = 7;
    hBlur.uniforms.h.value = bluriness / width;
    vBlur.uniforms.v.value = bluriness / height;
  
    badTVPass = new THREE.ShaderPass(THREE.BadTVShader);
    badTVPass.uniforms.distortion.value = 1.7;
    badTVPass.uniforms.distortion2.value = 2.7;
    badTVPass.uniforms.speed.value = 0.25;
    badTVPass.uniforms.rollSpeed.value = 0;
  
    const vlPass = new THREE.ShaderPass(THREE.VolumetericLightShader);
    vlShaderUniforms = vlPass.uniforms;
    vlPass.needsSwap = false;
  
    occlusionComposer = new THREE.EffectComposer(renderer, occRenderTarget);
    occlusionComposer.addPass(new THREE.RenderPass(scene, camera));
    occlusionComposer.addPass(hBlur);
    occlusionComposer.addPass(vBlur);
    occlusionComposer.addPass(hBlur);
    occlusionComposer.addPass(vBlur);
    occlusionComposer.addPass(hBlur);
    occlusionComposer.addPass(badTVPass);
    occlusionComposer.addPass(vlPass);
  
    bloomPass = new THREE.UnrealBloomPass(width / height, 2.5, 2.8, 3.3);
  
    filmPass = new THREE.ShaderPass(THREE.FilmShader);
    filmPass.uniforms.sCount.value = 1200;
    filmPass.uniforms.grayscale.value = false;
    filmPass.uniforms.sIntensity.value = 1.5;
    filmPass.uniforms.nIntensity.value = 0.2;
  
    const blendPass = new THREE.ShaderPass(THREE.AdditiveBlendingShader);
    blendPass.uniforms.tAdd.value = occRenderTarget.texture;
    blendPass.renderToScreen = false;
  
    blackKeyPass = new THREE.ShaderPass(THREE.BlackKeyShader);
    blackKeyPass.uniforms.threshold.value = 0.05;
    blackKeyPass.uniforms.thresholdEnd.value = 0.15;
    blackKeyPass.renderToScreen = true;
  
    const finalTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      transparent: true,
      alpha: true,
      premultipliedAlpha: false
    });
  
    composer = new THREE.EffectComposer(renderer, finalTarget);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(bloomPass);
    composer.addPass(badTVPass);
    composer.addPass(filmPass);
    composer.addPass(blendPass);
    composer.addPass(blackKeyPass);
  }
  
  function onFrame() {
    requestAnimationFrame(onFrame);
    update();
    render();
  }
  
  function update() {
    const timeDelta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
  
    filmPass.uniforms.time.value += timeDelta;
    badTVPass.uniforms.time.value += 0.01;
  
    if (itemMesh && occMesh) {
      itemMesh.rotation.y = Math.sin(elapsed / 2) / 15;
      itemMesh.rotation.z = Math.cos(elapsed / 2) / 50;
      occMesh.rotation.copy(itemMesh.rotation);
  
      const p = lightSource.position.clone();
      const vector = p.project(camera);
      const x = (vector.x + 1) / 2;
      const y = (vector.y + 1) / 2;
      vlShaderUniforms.lightPosition.value.set(x, y);
    }
  }
  
  function render() {
    camera.layers.set(OCCLUSION_LAYER);
    occlusionComposer.render();
  
    camera.layers.set(DEFAULT_LAYER);
    composer.render();
  }
  
  setupScene();
  setupPostprocessing();
  onFrame();
  