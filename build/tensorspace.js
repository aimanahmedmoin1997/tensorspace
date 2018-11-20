var TSP = (function (exports) {
'use strict';

/**
 * @author syt123450 / https://github.com/syt123450
 */

// min value area alpha



// side material, smaller than min alpha



let SideFaceRatio = 0.6;



let ModelInitWidth = 100;
let ModelLayerInterval = 50;
let FeatureMapIntervalRatio = 0.5;
let CloseButtonRatio = 0.03;
let MaxDepthInLayer = 30;
// compare with lenet to update camera pos to have a responsive view
let DefaultCameraPos = 600;
let DefaultLayerDepth = 8;
// neural interval is exact the same as neural length now
let OutputNeuralInterval = 1;

let FeatureMapTextRatio = 0.1;

let FeatureQueueTextRatio = 1.5;

let FrameColor = 0xA5A5A5;

// interval / segmentLength for adjacent segments in dense layer


// interval ratio for grid group
let GridIntervalRatio = 0.3;

// open layer animation time
let OpenTime = 2000;
// separate layer animation time
let SeparateTime = 1000;

/**
 * @author syt123450 / https://github.com/syt123450
 */

function SceneInitializer( container ) {

	this.container = container;

	this.scene = undefined;
	this.camera = undefined;
	this.stats = undefined;
	this.renderer = undefined;
	this.clock = undefined;
	this.cameraControls = undefined;
	this.raycaster = undefined;
	this.mouse = undefined;

	// control whether to show Stats panel, configured by Model Configuration
	this.hasStats = undefined;

	this.backgroundColor = undefined;

	this.sceneArea = undefined;

}

SceneInitializer.prototype = {

	loadSceneConfig: function( config ) {

		this.hasStats = config.stats;
		this.backgroundColor = config.color.background;

	},

	createScene: function() {

		let sceneArea = document.createElement( "canvas" );

		this.sceneArea = sceneArea;

		let cs = getComputedStyle( this.container );

		let paddingX = parseFloat( cs.paddingLeft ) + parseFloat( cs.paddingRight );
		let paddingY = parseFloat( cs.paddingTop ) + parseFloat( cs.paddingBottom );

		let borderX = parseFloat( cs.borderLeftWidth ) + parseFloat( cs.borderRightWidth );
		let borderY = parseFloat( cs.borderTopWidth ) + parseFloat( cs.borderBottomWidth );

		sceneArea.width = this.container.clientWidth - paddingX - borderX;
		sceneArea.height = this.container.clientHeight - paddingY - borderY;
		sceneArea.style.backgroundColor = this.backgroundColor;

		this.clock = new THREE.Clock();

		this.renderer = new THREE.WebGLRenderer( {

			canvas: sceneArea,
			antialias: true

		} );

		this.renderer.setSize( sceneArea.width, sceneArea.height );
		this.container.appendChild( this.renderer.domElement );

		this.camera = new THREE.PerspectiveCamera();
		this.camera.fov = 45;
		this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
		this.camera.near = 0.1;
		this.camera.far = 10000;

		this.camera.updateProjectionMatrix();
		this.camera.name = 'defaultCamera';

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( this.backgroundColor );

		if ( this.hasStats ) {

			this.stats = new Stats();
			this.stats.dom.style.position = "absolute";
			this.stats.dom.style.zIndex = "1";
			this.stats.showPanel( 0 );
			this.container.appendChild( this.stats.dom );

		}

		this.cameraControls = new THREE.TrackballControls( this.camera, this.renderer.domElement );
		this.cameraControls.target.set( 0, 0, 0 );

		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();

	},

	updateCamera: function() {

		let modelDepth = this.layers.length;
		let controlRatio = getControlRatio( modelDepth );

		this.camera.position.set(

			0,
			0,
			controlRatio * DefaultCameraPos * modelDepth / DefaultLayerDepth

		);

		// as strategy can not directly be applied to model when layer depth is too small, add a control ratio to move camera farther
		function getControlRatio( depth ) {

			if ( depth > 5 ) {

				return 1;

			} else if ( depth >= 3 && depth < 5 ) {

				return 1.5;

			} else {

				return 2;

			}

		}

	},

	// use animate scene
	animate: function() {

		let delta = this.clock.getDelta();

		this.cameraControls.update( delta );

		if ( this.hasStats ) {

			this.stats.update();

		}

		TWEEN.update();

		this.renderer.render( this.scene, this.camera );

		requestAnimationFrame( function() {

			this.animate();

		}.bind( this ) );

	},

	registerModelEvent: function() {

		window.addEventListener( 'resize', function() {

			this.onResize();

		}.bind( this ), false );

		this.sceneArea.addEventListener( 'mousemove', function( event ) {

			this.onMouseMove( event );

		}.bind( this ), true );

		this.sceneArea.addEventListener( 'click', function( event ) {

			this.onClick( event );

		}.bind( this ), true );

	},

	onResize: function() {

		this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( this.container.clientWidth, this.container.clientHeight );

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Layer.
	 * SubClasses ( specific Model ) override these abstract methods.
	 *
	 * ============
	 */

	/**
	 * onClick(), abstract method.
	 *
	 * Override this function to add handler for click event.
	 *
	 * @param event
	 */

	onClick: function( event ) {

	},

	/**
	 * onMouseMove(), abstract method.
	 *
	 * Override this function to add handler for mouse move event.
	 *
	 * @param event
	 */

	onMouseMove: function( event ) {

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Abstract Class, can not be initialized by TensorSpace user.
 * Load model from dependent library, for example, keras, tfjs, tensorflow.
 *
 * Base class for KerasLoader, TfjsLoader, TfLoader.
 *
 * @param model, model context
 * @param config, user's configuration for loader
 * @constructor
 */

function Loader( model, config ) {

	/**
	 * Store model context.
	 *
	 * { Object }, model context
	 */

	this.model = model;

	/**
	 * Store loader config.
	 *
	 * { JSON }, user's configuration for loader.
	 */

	this.config = config;

	/**
	 * Store callback function fired when model load process is completed.
	 *
	 * @type { function }
	 */

	this.onCompleteCallback = undefined;

	// Load loader's basic configuration.

	this.loadLoaderConfig( config );

}

Loader.prototype = {

	/**
	 * Load Loader's basic configuration.
	 *
	 * @param config, user's Loader configuration
	 */

	loadLoaderConfig: function( config ) {

		if ( this.config !== undefined )  {

			// If onComplete callback is defined by user, store it.

			if ( config.onComplete !== undefined ) {

				this.onCompleteCallback = config.onComplete;

			}

		}

	},

	/**
	 * Conditional execute load process.
	 *
	 * If model has not been initialized,
	 * prepare for actual load process, the actual load process will be executed in model's init period.
	 *
	 * If model has already bee initialized,
	 * execute actual load process.
	 *
	 */

	preLoad: function() {

		// Prepare for actual load process.

		this.model.loader = this;
		this.model.hasLoader = true;

		if ( this.model.isInitialized ) {

			// Execute actual load process.

			this.load().then( function() {

			} );

		}

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Predictor.
	 * SubClasses ( specific Loader ) override these abstract method to get Loader's characters.
	 *
	 * ============
	 */

	/**
	 * load(), load model asynchronously.
	 *
	 * Basically, has three steps:
	 * 1. Load model into TSP
	 * 2. Set predictor to TSP
	 * 3. Fire callback function if defined.
	 *
	 * @returns { Promise.<void> }
	 */

	load: async function() {

	},

	/**
	 * setPredictor(), create a predictor, config it and set the predictor for TSP model.
	 */

	setPredictor: function() {

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Abstract Class, can not be initialized by TensorSpace user.
 * Handle predict for model.
 *
 * Base class for KerasPredictor, TfjsPredictor, TfPredictor.
 *
 * @param model, model context
 * @param config, Predictor config, get it from loader
 * @constructor
 */

function Predictor( model, config ) {

	/**
	 * Store model context.
	 *
	 * { Object }, model context
	 */

	this.model = model;

	/**
	 * Identity whether model needs multiple inputs for prediction.
	 *
	 * @type { boolean }
	 */

	this.multiInputs = false;

	/**
	 * Input shapes if model has multiple inputs.
	 *
	 * @type { Array }
	 */

	this.inputShapes = undefined;

	/**
	 * Input shape if model has only one input.
	 *
	 * @type { Array }
	 */

	this.inputShape = undefined;

	// Load Predictor's basic configuration.

	this.loadPredictorConfig( config );

}

Predictor.prototype = {

	/**
	 * Load Predictor's basic configuration.
	 *
	 * @param config, user's Predictor configuration
	 */

	loadPredictorConfig: function( config ) {

		// Add inputShape or inputShapes from config.

		if ( this.model.modelType === "Sequential" ) {

			// In Sequential, has two input type.

			if ( config.multiInputs !== undefined && config.multiInputs === true ) {

				// Multiple inputs

				this.multiInputs = true;

				this.inputShapes = config.inputShapes;

			} else {

				// Single input.

				this.inputShape = this.model.layers[ 0 ].outputShape;

			}

		} else {

			// In Model, multiple inputs.

			this.multiInputs = true;

			let inputShapes = [];

			for ( let i = 0; i < this.model.inputs.length; i ++ ) {

				inputShapes.push( this.model.inputs[ i ] );

			}

			this.inputShapes = inputShapes;

		}

	},

	/**
	 * createInputTensor(), create tfjs Tensor which can be used for prediction.
	 *
	 * @param data, user's raw prediction data
	 * @returns { tf.Tensor }
	 */

	createInputTensor: function( data ) {

		if ( this.multiInputs ) {

			return this.createInputTensorList( data, this.inputShapes );

		} else {

			return this.createOneInputTensor( data, this.inputShape );

		}

	},

	/**
	 * createOneInputTensor(), transfer an data array into a Tensor based on tensor shape.
	 *
	 * @param data, a list of input data, for example, [ 0.1, 0.15 ......, 0.2 ]
	 * @param inputShape
	 * @returns { tf.Tensor }
	 */

	createOneInputTensor: function( data, inputShape ) {

		// Support predict one input data at a time, set batch size to be 1.

		let batchSize = [ 1 ];
		let predictTensorShape = batchSize.concat( inputShape );

		return tf.tensor( data, predictTensorShape );

	},

	/**
	 * createInputTensorList(), transfer data arrays into a Tensors based on tensor shapes.
	 *
	 * @param data, input data list, for example, [[...], [...], ..., [...]]
	 * @param inputShapes
	 * @returns { tf.Tensor[] }
	 */

	createInputTensorList: function( data, inputShapes ) {

		let tensorList = [];

		for ( let i = 0; i < inputShapes.length; i ++ ) {

			tensorList.push( this.createOneInputTensor( data[ i ], inputShapes[ i ] ) );

		}

		return tensorList;

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Predictor.
	 * SubClasses ( specific Predictor ) override these abstract method to get Predictor's characters.
	 *
	 * ============
	 */

	/**
	 * predict(), Called by model to get prediction result.
	 *
	 * Override this function to implement actual prediction work
	 *
	 * @param data, input data
	 */

	predict: function( data ) {

		return [];

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Handle prediction for tfjs model.
 *
 * @param model, model context
 * @param config, Predictor config
 * @constructor
 */

function TfjsPredictor( model, config ) {

	// "TfjsPredictor" inherits from abstract predictor "Predictor".

	Predictor.call( this, model, config );

	this.predictorType = "TfjsPredictor";

}

TfjsPredictor.prototype = Object.assign( Object.create( Predictor.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class Predictor's abstract method
	 *
	 * TfjsPredictor overrides Predictor's function:
	 * predict
	 *
	 * ============
	 */

	/**
	 * predict(), Called by model to get prediction result.
	 *
	 * @param data, input data
	 */

	predict: function( data ) {

		let predictor = this;

		let predictResult = tf.tidy( () => {

			// Create input tensor for prediction.

			let inputTensor = predictor.createInputTensor( data );

			// Get prediction result from loaded model.

			return predictor.model.resource.predict( inputTensor );

		} );

		return predictResult;

	}

	/**
	 * ============
	 *
	 * Functions above override base class Predictor's abstract method.
	 *
	 * ============
	 */

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Load tfjs model for TensorSpace.
 *
 * @param model, model context
 * @param config, user's configuration for Loader
 * @constructor
 */

function TfjsLoader( model, config ) {

	// "TfjsLoader" inherits from abstract Loader "Loader".

	Loader.call( this, model, config );

	/**
	 * tfjs model's url (.json file's url).
	 * TfjsLoader will get tfjs model from this url.
	 *
	 * @type { url }
	 */

	this.url = undefined;

	// Load TfjsLoader's configuration.

	this.loadTfjsConfig( config );

	this.loaderType = "TfjsLoader";

}

TfjsLoader.prototype = Object.assign( Object.create( Loader.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class Loader's abstract method
	 *
	 * TfjsLoader overrides Loader's function:
	 * load, setPredictor
	 *
	 * ============
	 */

	/**
	 * load(), load tfjs model asynchronously.
	 *
	 * Three steps:
	 * 1. Load tfjs model into TSP
	 * 2. Set tfjs predictor to TSP
	 * 3. Fire callback function if defined.
	 *
	 * @returns { Promise.<void> }
	 */

	load: async function() {

		const loadedModel = await tf.loadModel( this.url );

		this.model.resource = loadedModel;

		this.setPredictor();

		if ( this.onCompleteCallback !== undefined ) {

			this.onCompleteCallback();

		}

	},

	/**
	 * setPredictor(), create a tfjs predictor, config it and set the predictor for TSP model.
	 */

	setPredictor: function() {

		let tfjsPredictor = new TfjsPredictor( this.model, this.config );

		this.model.predictor = tfjsPredictor;

	},

	/**
	 * ============
	 *
	 * Functions above override base class Predictor's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadTfjsConfig(), Load user's configuration into TfjsLoader.
	 * The configuration load in this function sometimes has not been loaded in "Loader"'s "loadLoaderConfig".
	 *
	 * @param loaderConfig
	 */

	loadTfjsConfig: function( loaderConfig ) {

		// "url" configuration is required.

		if ( loaderConfig.url !== undefined ) {

			this.url = loaderConfig.url;

		} else {

			console.error( "\"url\" property is required to load tensorflow.js model." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Handle prediction for keras model.
 *
 * @param model, model context
 * @param config, Predictor config
 * @constructor
 */

function KerasPredictor( model, config ) {

	// "KerasPredictor" inherits from abstract predictor "Predictor".

	Predictor.call( this, model, config );

	this.predictorType = "KerasPredictor";

}

KerasPredictor.prototype = Object.assign( Object.create( Predictor.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class Predictor's abstract method
	 *
	 * KerasPredictor overrides Predictor's function:
	 * predict
	 *
	 * ============
	 */

	/**
	 * predict(), Called by model to get prediction result.
	 *
	 * @param data, input data
	 */

	predict: function( data ) {

		let predictor = this;

		let predictResult = tf.tidy( () => {

			// Create input tensor for prediction.

			let inputTensor = predictor.createInputTensor( data );

			// Get prediction result from loaded model.

			return predictor.model.resource.predict( inputTensor );

		} );

		return predictResult;

	}

	/**
	 * ============
	 *
	 * Functions above override base class Predictor's abstract method.
	 *
	 * ============
	 */

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Load keras model for TensorSpace.
 *
 * @param model, model context
 * @param config, user's configuration for Loader
 * @constructor
 */

function KerasLoader( model, config ) {

	// "KerasLoader" inherits from abstract Loader "Loader".

	Loader.call( this, model, config );

	/**
	 * Keras model's url (.json file's url).
	 * KerasLoader will get Keras model from this url.
	 *
	 * @type { url }
	 */

	this.url = undefined;

	// Load KerasLoader's configuration.

	this.loadKerasConfig( config );

	this.loaderType = "KerasLoader";

}

KerasLoader.prototype = Object.assign( Object.create( Loader.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class Loader's abstract method
	 *
	 * KerasLoader overrides Loader's function:
	 * load, setPredictor
	 *
	 * ============
	 */

	/**
	 * load(), load Keras model asynchronously.
	 *
	 * Three steps:
	 * 1. Load Keras model into TSP
	 * 2. Set Keras predictor to TSP
	 * 3. Fire callback function if defined.
	 *
	 * @returns { Promise.<void> }
	 */

	load: async function() {

		const loadedModel = await tf.loadModel( this.url );

		this.model.resource = loadedModel;

		this.setPredictor();

		if ( this.onCompleteCallback !== undefined ) {

			this.onCompleteCallback();

		}

	},

	/**
	 * setPredictor(), create a keras predictor, config it and set the predictor for TSP model.
	 */

	setPredictor: function() {

		let kerasPredictor = new KerasPredictor( this.model, this.config );

		this.model.predictor = kerasPredictor;

	},

	/**
	 * ============
	 *
	 * Functions above override base class Predictor's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadKerasConfig(), Load user's configuration into KerasLoader.
	 * The configuration load in this function sometimes has not been loaded in "Loader"'s "loadLoaderConfig".
	 *
	 * @param loaderConfig
	 */

	loadKerasConfig: function( loaderConfig ) {

		// "url" configuration is required.

		if ( loaderConfig.url !== undefined ) {

			this.url = loaderConfig.url;

		} else {

			console.error( "\"url\" property is required to load Keras model." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

/**
 * Handle prediction for tensorflow model.
 *
 * @param model, model context
 * @param config, Predictor config
 * @constructor
 */

function TfPredictor( model, config ) {

	// "TfPredictor" inherits from abstract predictor "Predictor".

	Predictor.call( this, model, config );

	/**
	 * list of output node names.
	 *
	 * @type { Array }
	 */

	this.outputsName = undefined;

	this.predictorType = "TfPredictor";

}

TfPredictor.prototype = Object.assign( Object.create( Predictor.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class Predictor's abstract method
	 *
	 * TfPredictor overrides Predictor's function:
	 * predict
	 *
	 * ============
	 */

	/**
	 * predict(), Called by model to get prediction result.
	 *
	 * @param data, input data
	 */

	predict: function( data ) {

		let predictor = this;

		let predictResult = tf.tidy( () => {

			// Create input tensor for prediction.

			let inputTensor = predictor.createInputTensor( data );

			let predictResult;

			if ( this.outputsName !== undefined ) {

				// If has outputsName, use execute to get prediction result.

				predictResult = predictor.model.resource.execute( inputTensor, this.outputsName );

			} else {

				// If outputsName is undefined, use predict to get prediction result.

				predictResult = predictor.model.resource.predict( inputTensor );

			}

			return predictResult;

		} );

		return predictResult;

	},

	/**
	 * ============
	 *
	 * Functions above override base class Predictor's abstract method.
	 *
	 * ============
	 */

	/**
	 * setOutputsName(), Store user's predefined outputsName list.
	 *
	 * @param names, { Array }, list of output node names.
	 */

	setOutputsName: function( names ) {

		this.outputsName = names;

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Load tensorflow model for TensorSpace.
 *
 * @param model, model context
 * @param config, user's configuration for Loader
 * @constructor
 */

function TfLoader( model, config ) {

	// "TfLoader" inherits from abstract Loader "Loader".

	Loader.call( this, model, config );

	/**
	 * tensorflow model's url (.pb file's url).
	 * Important parameter for TfLoader to get tensorflow model.
	 *
	 * @type { url }
	 */

	this.modelUrl = undefined;

	/**
	 * tensorflow weight's url (.json file's url).
	 * Important parameter for TfLoader to get tensorflow model.
	 *
	 * @type { url }
	 */

	this.weightUrl = undefined;

	/**
	 * User's predefined outputsName list.
	 * If set, TfLoader will set this name list to TfPredictor.
	 *
	 * @type { Array }
	 */

	this.outputsName = undefined;

	// Load TfLoader's configuration.

	this.loadTfConfig( config );

	this.loaderType = "TfLoader";

}

TfLoader.prototype = Object.assign( Object.create( Loader.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class Loader's abstract method
	 *
	 * TfLoader overrides Loader's function:
	 * load, setPredictor
	 *
	 * ============
	 */

	/**
	 * load(), load tensorflow model asynchronously.
	 *
	 * Three steps:
	 * 1. Load tensorflow model into TSP
	 * 2. Set tensorflow predictor to TSP
	 * 3. Fire callback function if defined.
	 *
	 * @returns { Promise.<void> }
	 */

	load: async function() {

		const loadedModel = await tf.loadFrozenModel( this.modelUrl, this.weightUrl );

		this.model.resource = loadedModel;

		this.setPredictor();

		if ( this.onCompleteCallback !== undefined ) {

			this.onCompleteCallback();

		}

	},

	/**
	 * setPredictor(), create a tensorflow predictor, config it and set the predictor for TSP model.
	 */

	setPredictor: function() {

		let tfPredictor = new TfPredictor( this.model, this.config );
		tfPredictor.setOutputsName( this.outputsName );

		this.model.predictor = tfPredictor;

	},

	/**
	 * ============
	 *
	 * Functions above override base class Predictor's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadTfConfig(), Load user's configuration into TfLoader.
	 * The configuration load in this function sometimes has not been loaded in "Loader"'s "loadLoaderConfig".
	 *
	 * @param loaderConfig
	 */

	loadTfConfig: function( loaderConfig ) {

		// "modelUrl" configuration is required.

		if ( loaderConfig.modelUrl !== undefined ) {

			this.modelUrl = loaderConfig.modelUrl;

		} else {

			console.error( "\"modelUrl\" property is required to load tensorflow model." );

		}

		// "weightUrl" configuration is required.

		if ( loaderConfig.weightUrl !== undefined ) {

			this.weightUrl = loaderConfig.weightUrl;

		} else {

			console.error( "\"weightUrl\" property is required to load tensorflow model." );

		}

		// Optional configuration.

		if ( loaderConfig.outputsName !== undefined ) {

			this.outputsName = loaderConfig.outputsName;

		}

	}

} );

/**
 * Handle prediction for live model (tfjs model, as only tfjs can train in the browser).
 * May be there will other training library can run in the browser, so use a new Predictor.
 *
 * @param model, model context
 * @param config, Predictor config
 * @constructor
 */

function LivePredictor( model, config ) {

	// "LivePredictor" inherits from abstract predictor "TfjsPredictor".

	TfjsPredictor.call( this, model, config );

	this.predictorType = "LivePredictor";

}

LivePredictor.prototype = Object.assign( Object.create( TfjsPredictor.prototype ), {


} );

/**
 * Load live model for TensorSpace.
 * As keras and tensorflow model can not run in the browser, this live loader works for tfjs model.
 *
 * @param model, model context
 * @param config, user's configuration for Loader
 * @constructor
 */

function LiveLoader( model, config ) {

	// "LiveLoader" inherits from abstract Loader "Loader".

	Loader.call( this, model, config );

	/**
	 * tfjs model's reference
	 * LiveLoader will store tfjs model's reference into TensorSpace model.
	 *
	 * @type { reference }
	 */

	this.modelHandler = undefined;

	this.loadLiveConfig( config );

	this.loaderType = "liveLoader";

}

LiveLoader.prototype = Object.assign( Object.create( Loader.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class Loader's abstract method
	 *
	 * LiveLoader overrides Loader's function:
	 * load, setPredictor
	 *
	 * ============
	 */

	/**
	 * load(), load a live tfjs model.
	 * Its an synchronous process, to make it compatible with other loader, use async method.
	 *
	 * Three steps:
	 * 1. Load tfjs model into TSP
	 * 2. Set live predictor to TSP
	 * 3. Fire callback function if defined.
	 *
	 * @returns { Promise.<void> }
	 */

	load: async function() {

		this.model.resource = this.modelHandler;

		this.setPredictor();

		if ( this.onCompleteCallback !== undefined ) {

			this.onCompleteCallback();

		}

	},

	/**
	 * setPredictor(), create a live predictor, config it and set the predictor for TSP model.
	 */

	setPredictor: function() {

		let livePredictor = new LivePredictor( this.model, this.config );

		this.model.predictor = livePredictor;

	},

	/**
	 * ============
	 *
	 * Functions above override base class Predictor's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLiveConfig(), Load user's configuration into LiveLoader.
	 * The configuration load in this function sometimes has not been loaded in "Loader"'s "loadLoaderConfig".
	 *
	 * @param loaderConfig
	 */

	loadLiveConfig: function( loaderConfig ) {

		// "modelHandler" configuration is required.

		if ( loaderConfig.modelHandler !== undefined ) {

			this.modelHandler = loaderConfig.modelHandler;

		} else {

			console.error( "\"modelHandler\" property is required to load live model." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function ModelConfiguration(config ) {

	this.layerInitStatus = false;
	this.layerShape = "rect";
	this.aggregationStrategy = "average";
	this.relationSystem = true;
	this.textSystem = true;
	this.stats = false;
	this.animationTimeRatio = 1;
	this.minOpacity = 0.4;
	this.color = {

		background: 0x000000,
		input1d: 0xEEEEEE,
		greyscaleInput: 0xEEEEEE,
		RGBInput: 0xEEEEEE,
		conv1d: 0xF7FE2E,
		conv2d: 0xF7FE2E,
		depthwiseConv2d: 0xFBBF1F,
		conv2dTranspose: 0xff5722,
		cropping1d: 0xcefc86,
		cropping2d: 0xcefc86,
		pooling1d: 0x00ffff,
		pooling2d: 0x00ffff,
		dense: 0x00ff00,
		padding1d: 0x6eb6ff,
		padding2d: 0x6eb6ff,
		output1d: 0xEEEEEE,
		output2d: 0xEEEEEE,
		outputDetection: 0xEEEEEE,
		yoloGrid: 0xEEEEEE,
		flatten: 0xdfe2fe,
		globalPooling1d: 0x6eb6ff,
		globalPooling2d: 0x6eb6ff,
		upSampling1d: 0x30e3ca,
		upSampling2d: 0x30e3ca,
		reshape: 0xa287f4,
		activation1d: 0xfc5c9c,
		activation2d: 0xfc5c9c,
		activation3d: 0xfc5c9c,
		basicLayer1d: 0xf08a5d,
		basicLayer2d: 0xf08a5d,
		basicLayer3d: 0xf08a5d,

		add: 0xe23e57,
		subtract: 0xe23e57,
		multiply: 0xe23e57,
		maximum: 0xe23e57,
		average: 0xe23e57,
		dot: 0xe23e57,
		concatenate: 0xf9a1bc

	};

	if ( config !== undefined ) {

		if ( config.layerShape !== undefined ) {

			this.layerShape = config.layerShape;

		}

		if ( config.aggregationStrategy !== undefined ) {

			if ( config.aggregationStrategy === "average" || config.aggregationStrategy === "max" ) {

				this.aggregationStrategy = config.aggregationStrategy;

			} else {

				console.error( "\"aggregationStrategy\" property do not support config for " + config.aggregationStrategy + " use \"average\" or \"max\" instead." );

			}

		}

		if ( config.relationSystem !== undefined ) {

			if ( config.relationSystem === "enable" ) {

				this.relationSystem = true;

			} else if ( config.relationSystem === "disable" ) {

				this.relationSystem = false;

			} else {

				console.error( "\"relationSystem\" property do not support config for " + config.relationSystem + " use \"enable\" or \"disable\" instead." );

			}

		}

		if ( config.textSystem !== undefined ) {

			if ( config.textSystem === "enable" ) {

				this.textSystem = true;

			} else if ( config.textSystem === "disable" ) {

				this.textSystem = false;

			} else {

				console.error( "\"textSystem\" property do not support config for " + config.textSystem + " use \"enable\" or \"disable\" instead." );

			}

		}

		if ( config.layerInitStatus !== undefined ) {

			if ( config.layerInitStatus === "close" ) {

				this.layerInitStatus = false;

			} else if ( config.layerInitStatus === "open" ) {

				this.layerInitStatus = true;

			} else {

				console.error( "LayerInitStatus " + config.layerInitStatus +" is not support." );

			}

		}

		if ( config.animationTimeRatio !== undefined ) {

			if ( config.animationTimeRatio > 0 ) {

				this.animationTimeRatio = config.animationTimeRatio;

			}

		}

		if ( config.minOpacity !== undefined ) {

			if ( config.minOpacity > 0 ) {

				this.minOpacity = config.minOpacity;

			}

		}

		if ( config.stats !== undefined ) {

			this.stats = config.stats;

		}

		if ( config.color !== undefined ) {

			if ( config.color.background !== undefined ) {

				this.color.background = config.color.background;

			}

			if ( config.color.input1d !== undefined ) {

				this.color.input1d = config.color.input1d;

			}

			if ( config.color.greyscaleInput !== undefined ) {

				this.color.greyscaleInput = config.color.greyscaleInput;

			}

			if ( config.color.RGBInput !== undefined ) {

				this.color.RGBInput = config.color.RGBInput;

			}

			if ( config.color.conv1d !== undefined ) {

				this.color.conv1d = config.color.conv1d;

			}

			if ( config.color.conv2d !== undefined ) {

				this.color.conv2d = config.color.conv2d;

			}

			if ( config.color.conv2dTranspose !== undefined ) {

				this.color.conv2dTranspose = config.color.conv2dTranspose;

			}

			if ( config.color.cropping1d !== undefined ) {

				this.color.cropping1d = config.color.cropping1d;

			}

			if ( config.color.cropping2d !== undefined ) {

				this.color.cropping2d = config.color.cropping2d;

			}

			if ( config.color.pooling1d !== undefined ) {

				this.color.pooling1d = config.color.pooling1d;

			}

			if ( config.color.pooling2d !== undefined ) {

				this.color.pooling2d = config.color.pooling2d;

			}

			if ( config.color.dense !== undefined ) {

				this.color.dense = config.color.dense;

			}

			if ( config.color.padding1d !== undefined ) {

				this.color.padding1d = config.color.padding1d;

			}

			if ( config.color.padding2d !== undefined ) {

				this.color.padding2d = config.color.padding2d;

			}

			if ( config.color.output1d !== undefined ) {

				this.color.output1d = config.color.output1d;

			}

			if ( config.color.output2d !== undefined ) {

				this.color.output2d = config.color.output2d;

			}

			if ( config.color.outputDetection !== undefined ) {

				this.color.outputDetection = config.color.outputDetection;

			}

			if ( config.color.yoloGrid !== undefined ) {

				this.color.yoloGrid = config.color.yoloGrid;

			}

			if ( config.color.flatten !== undefined ) {

				this.color.flatten = config.color.flatten;

			}

			if ( config.color.globalPooling1d !== undefined ) {

				this.color.globalPooling1d = config.color.globalPooling1d;

			}

			if ( config.color.globalPooling2d !== undefined ) {

				this.color.globalPooling2d = config.color.globalPooling2d;

			}

			if ( config.color.upSampling1d !== undefined ) {

				this.color.upSampling1d = config.color.upSampling1d;

			}

			if ( config.color.upSampling2d !== undefined ) {

				this.color.upSampling2d = config.color.upSampling2d;

			}

			if ( config.color.reshape !== undefined ) {

				this.color.reshape = config.color.reshape;

			}

			if ( config.color.activation1d !== undefined ) {

				this.color.activation1d = config.color.activation1d;

			}

			if ( config.color.activation2d !== undefined ) {

				this.color.activation2d = config.color.activation2d;

			}

			if ( config.color.activation3d !== undefined ) {

				this.color.activation3d = config.color.activation3d;

			}

			if ( config.color.basicLayer1d !== undefined ) {

				this.color.basicLayer1d = config.color.basicLayer1d;

			}

			if ( config.color.basicLayer2d !== undefined ) {

				this.color.basicLayer2d = config.color.basicLayer2d;

			}

			if ( config.color.basicLayer3d !== undefined ) {

				this.color.basicLayer3d = config.color.basicLayer3d;

			}

			if ( config.color.add !== undefined ) {

				this.color.add = config.color.add;

			}

			if ( config.color.subtract !== undefined ) {

				this.color.subtract = config.color.subtract;

			}

			if ( config.color.multiply !== undefined ) {

				this.color.multiply = config.color.multiply;

			}

			if ( config.color.maximum !== undefined ) {

				this.color.maximum = config.color.maximum;

			}

			if ( config.color.average !== undefined ) {

				this.color.average = config.color.average;

			}

			if ( config.color.dot !== undefined ) {

				this.color.dot = config.color.dot;

			}

			if ( config.color.concatenate !== undefined ) {

				this.color.concatenate = config.color.concatenate;

			}

		}

	}

	return this;

}

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

/**
 * AbstractModel, abstract model, should not be initialized directly.
 * Base class for Sequential, Model
 *
 * @param container, a DOM element where TSP model will be rendered to.
 * @param config, user's config for Sequential model.
 * @constructor
 */

function AbstractModel( container, config ) {

	// AbstractModel mixin "SceneInitializer".

	SceneInitializer.call( this, container );

	/**
	 *	Store loader.
	 *	Three kinds of loader: TfLoader, TfjsLoader, KerasLoader.
	 *
	 * @type { Loader }
	 */

	this.loader = undefined;

	/**
	 * Sign showing whether model has a preload loader.
	 * true -- has a preload loader
	 * false -- empty model, do not have a preload loader
	 *
	 * @type { boolean }
	 */

	this.hasLoader = false;

	/**
	 * Whether model has loaded a prediction model.
	 * true -- A loader has already load a prediction to TSP model
	 * false -- Empty model, do not have a prediction for prediction
	 *
	 * @type { boolean }
	 */

	this.isInitialized = false;

	/**
	 * Actual prediction model.
	 * undefined means no prediction model.
	 *
	 * @type { model }
	 */

	this.resource = undefined;

	/**
	 * Store user's input value for prediction.
	 *
	 * @type { Array }
	 */

	this.inputValue = undefined;

	/**
	 * Store prediction result from prediction model.
	 *
	 * @type { undefined }
	 */

	this.predictResult = undefined;

	/**
	 * Used to trigger model prediction and get predict result
	 *
	 * @type { Predictor }
	 */

	this.predictor = undefined;

	/**
	 * Prediction model type.
	 * Three types now: "Model", "Sequential"
	 *
	 * @type { string }
	 */

	this.modelType = undefined;

	/**
	 * Store all layers in Model.
	 *
	 * @type { Layer[] }
	 */

	this.layers = [];

	/**
	 * Record layer hovered by mouse now.
	 *
	 * @type { Layer }
	 */

	this.hoveredLayer = undefined;

	/**
	 * Model configuration.
	 * Initialized with user's model config and default model config.
	 *
	 * @type { ModelConfiguration }
	 */

	this.configuration = new ModelConfiguration( config );

	// Pass configuration to three.js scene.

	this.loadSceneConfig( this.configuration );

	// Create actual three.js scene.

	this.createScene();

}

AbstractModel.prototype = Object.assign( Object.create( SceneInitializer.prototype ), {

	/**
	 * load(), load prediction model based on "type" attribute in user's configuration.
	 *
	 * @param config
	 */

	load: function( config ) {

		if ( config.type === "tfjs" ) {

			this.loadTfjsModel( config );

		} else if ( config.type === "keras" ) {

			this.loadKerasModel( config );

		} else if ( config.type === "tensorflow" ) {

			this.loadTfModel( config );

		} else if ( config.type = "live" ) {

			this.loadLiveModel( config );

		} else {

			console.error( "Do not support to load model type " + config.type );

		}

	},

	/**
	 * loadTfjsModel(), create TFJSLoader and execute preLoad.
	 *
	 * @param config, user's config for TfjsLoader.
	 */

	loadTfjsModel: function( config ) {

		let loader = new TfjsLoader( this, config );
		loader.preLoad();

	},

	/**
	 * loadKerasModel(), create KerasLoader and execute preLoad.
	 *
	 * @param config, user's config for KerasLoader.
	 */

	loadKerasModel: function( config ) {

		let loader = new KerasLoader( this, config );
		loader.preLoad();

	},

	/**
	 * loadTfModel(), create TfLoader and execute preLoad.
	 *
	 * @param config, user's config for TfLoader.
	 */

	loadTfModel: function( config ) {

		let loader = new TfLoader( this, config );
		loader.preLoad();

	},

	loadLiveModel: function( config ) {

		let loader = new LiveLoader( this, config );
		loader.preLoad();

	},

	/**
	 * Store loader.
	 *
	 * @param loader
	 */

	setLoader: function( loader ) {

		this.loader = loader;

	},

	/**
	 * Get TSP layer stored in model by name.
	 *
	 * @param name
	 * @return { Layer }, layer with given name.
	 */

	getLayerByName: function( name ) {

		for ( let i = 0; i < this.layers.length; i ++ ) {

			if ( this.layers[ i ].name === name ) {

				return this.layers[ i ];

			}

		}

	},

	/**
	 * Get all TSP layer stored in model.
	 *
	 * @return { Layer[] }, layer list.
	 */

	getAllLayers: function() {

		return this.layers;

	},

	/**
	 * init(), Init model,
	 * As TSP is applying lazy initialization strategy, time-consuming work will be done in this process.
	 * After init process, the model will be rendered onto container.
	 *
	 * @param callback, user's predefined callback function, fired when init process completed.
	 */

	init: function( callback ) {

		if ( this.hasLoader ) {

			// If has a predefined loader, load model before init sequential elements.

			let self = this;
			this.loader.load().then( function() {

				// Init sequential elements.

				self.initTSPModel();

				// Execute callback at the end if callback function is predefined.

				if ( callback !== undefined ) {

					callback();

				}

			} );

		} else {

			// Init sequential elements.

			this.initTSPModel();

			// Execute callback at the end if callback function is predefined.

			if ( callback !== undefined ) {

				callback();

			}

		}

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Layer.
	 * SubClasses ( specific Model ) override these abstract methods.
	 *
	 * ============
	 */

	/**
	 * predict(), abstract method
	 *
	 * Generates output predictions for the input sample.
	 *
	 * @param input, user's input data
	 * @param callback, user' predefined callback function, execute after prediction.
	 */

	predict: function( input, callback ) {


	},

	/**
	 * clear(), abstract method
	 *
	 * Override to clear all layers' visualization and model's input data.
	 */

	clear: function() {

	},

	/**
	 * reset(), abstract method
	 *
	 * Override to add reset model.
	 */

	reset: function() {

	},

	/**
	 * onClick(), abstract method.
	 *
	 * override this function to add handler for click event.
	 *
	 * @param event
	 */

	onClick: function( event ) {

	},

	/**
	 * onMouseMove(), abstract method.
	 *
	 * Override this function to add handler for mouse move event.
	 *
	 * @param event
	 */

	onMouseMove: function( event ) {

	},

	/**
	 * initTSPModel(), abstract method
	 *
	 * Override to handle actual element creation.
	 */

	initTSPModel: function() {

	}

} );

let LayerLocator = ( function() {

	function calculateLayersPos( layers ) {

		let depth = layers.length;
		let layersPos = [];

		let initPos;

		if ( depth % 2 === 1 ) {

			initPos = - ModelLayerInterval * ( ( depth - 1 ) / 2 );

		} else {

			initPos = - ModelLayerInterval * ( depth / 2 ) + ModelLayerInterval / 2;

		}

		for ( let i = 0; i < depth; i ++ ) {

			if ( !layers[ i ].isGroup  ) {

				layersPos.push( {

					x: 0,
					y: initPos,
					z: 0

				} );

				initPos += ModelLayerInterval;

			} else {

				let posArray = [];

				for ( let j = 0; j < layers[ i ].thickness; j ++ ) {

					posArray.push( {

						x: 0,
						y: initPos,
						z: 0

					} );

					initPos += ModelLayerInterval;

				}

				layersPos.push( posArray );

			}

		}

		return layersPos;

	}

	function calculateLevelCenters( levels ) {

		let centers = [];

		let initY = - ( levels - 1 ) / 2 * ModelLayerInterval;

		for ( let i = 0; i < levels; i ++ ) {

			centers.push( {

				x: 0,
				y: initY + ModelLayerInterval * i,
				z: 0

			} );

		}

		return centers;

	}

	return {

		calculateLayersPos: calculateLayersPos,

		calculateLevelCenters: calculateLevelCenters

	}

} )();

let ActualDepthCalculator = (function() {

	function calculateDepths( layers ) {

		let depthList = [];
		let maxDepthValue = 0;
		let actualDepthList = [];

		for ( let i = 0; i < layers.length; i ++ ) {

			let layerDepth = layers[ i ].depth;

			if ( layerDepth !== undefined ) {

				maxDepthValue = maxDepthValue > layerDepth ? maxDepthValue : layerDepth;
				depthList.push( layerDepth );

			} else {

				depthList.push( 1 );

			}

		}

		for ( let i = 0; i < layers.length; i ++ ) {

			if ( depthList[ i ] / maxDepthValue * MaxDepthInLayer > 1 ) {

				actualDepthList.push( depthList[ i ] / maxDepthValue * MaxDepthInLayer );

			} else {

				actualDepthList.push( 1 );

			}

		}

		return actualDepthList;

	}

	return {

		calculateDepths: calculateDepths

	}

})();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let MouseCaptureHelper = ( function() {

	function getElementViewTop( element ){

		let actualTop = element.offsetTop;
		let current = element.offsetParent;

		while ( current !== null ) {

			actualTop += current.offsetTop;
			current = current.offsetParent;

		}

		let elementScrollTop;

		if ( document.compatMode === "BackCompat" ) {

			elementScrollTop = document.body.scrollTop;

		} else {

			if ( document.documentElement.scrollTop === 0 ) {

				elementScrollTop = document.body.scrollTop;

			} else {

				elementScrollTop = document.documentElement.scrollTop;

			}

		}

		return actualTop - elementScrollTop;

	}

	function getElementViewLeft( element ) {

		let actualLeft = element.offsetLeft;
		let current = element.offsetParent;

		while ( current !== null ) {

			actualLeft += current.offsetLeft;
			current = current.offsetParent;

		}

		let elementScrollLeft;

		if ( document.compatMode === "BackCompat" ) {

			elementScrollLeft = document.body.scrollLeft;

		} else {

			if ( document.documentElement.scrollTop === 0 ) {

				elementScrollLeft = document.body.scrollLeft;

			} else {

				elementScrollLeft = document.documentElement.scrollLeft;

			}

		}

		return actualLeft - elementScrollLeft;

	}

	return {

		getElementViewTop: getElementViewTop,

		getElementViewLeft: getElementViewLeft

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * A model with linear stack of layers.
 *
 * @param container, a DOM element where TSP model will be rendered to.
 * @param config, user's config for Sequential model.
 * @constructor
 */

function Sequential( container, config ) {

	// "Sequential" inherits from abstract Model "AbstractModel".

	AbstractModel.call( this, container, config );

	this.modelType = "Sequential";

}

Sequential.prototype = Object.assign( Object.create( AbstractModel.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class AbstractModel's abstract method
	 *
	 * Sequential overrides AbstractModel's function:
	 * predict, clear, reset, onClick, onMouseMove, initTSPModel
	 *
	 * ============
	 */

	/**
	 * predict(), Generates output predictions for the input sample.
	 *
	 * @param input
	 * @param callback
	 */

	predict: function( input, callback ) {

		this.clear();

		this.inputValue = input;

		if ( this.resource !== undefined ) {

			// If a prediction model has already been loaded into TSP, use predictor to get the prediction result.

			this.predictResult = this.predictor.predict( input );

			// Update all layer's visualization.

			this.updateVis();

		} else {

			// If no prediction model be loaded into TSP, just update the input layer.

			this.updateInputVis();

		}

		if ( callback !== undefined ) {

			callback( this.predictResult[ this.predictResult.length - 1 ].dataSync() );

		}

	},

	/**
	 * clear(), clear all layers' visualization and model's input data.
	 */

	clear: function() {

		if ( this.predictResult !== undefined ) {

			for ( let i = 0; i < this.predictResult.length; i ++ ) {

				tf.dispose( this.predictResult[ i ] );

			}

			this.predictResult = undefined;

		}

		for ( let i = 0; i < this.layers.length; i ++ ) {

			this.layers[ i ].clear();

		}

		this.inputValue = undefined;

	},

	/**
	 * reset(), reset the model.
	 *
	 * Three steps:
	 * 1. clear the layer visualization;
	 * 2. reset TrackballControl;
	 * 3. update camera setting in TSP.
	 */

	reset: function() {

		this.clear();
		this.cameraControls.reset();
		this.updateCamera();

	},

	/**
	 * onClick(), Handler for move click event.
	 *
	 * @param event
	 */

	onClick: function ( event ) {

		let model = this;

		// Use Raycaster to capture clicked element.

		model.raycaster.setFromCamera( model.mouse, model.camera );
		let intersects = model.raycaster.intersectObjects( model.scene.children, true );

		for ( let i = 0; i < intersects.length; i ++ ) {

			if ( intersects !== null && intersects.length > 0 && intersects[ i ].object.type === "Mesh" ) {

				let selectedElement = intersects[ i ].object;

				if ( selectedElement.clickable === true ) {

					// Let the layer to handle actual click event.

					let selectedLayer = this.layers[ selectedElement.layerIndex - 1 ];

					selectedLayer.handleClick( selectedElement );

					break;

				}

			}

		}

	},

	/**
	 * onMouseMove(), Handler for mouse move event.
	 *
	 * @param event
	 */

	onMouseMove: function( event ) {

		// calculate mouse position.

		this.mouse.x = ( ( event.clientX - MouseCaptureHelper.getElementViewLeft( this.sceneArea ) ) / this.sceneArea.clientWidth ) * 2 - 1;
		this.mouse.y = - ( ( event.clientY - MouseCaptureHelper.getElementViewTop( this.sceneArea ) )  / this.sceneArea.clientHeight ) * 2 + 1;

		let model = this;

		if ( model.hoveredLayer !== undefined ) {

			model.hoveredLayer.handleHoverOut();
			model.hoveredLayer = undefined;

		}

		// Use Raycaster to capture hovered element.

		model.raycaster.setFromCamera( model.mouse, model.camera );
		let intersects = model.raycaster.intersectObjects( model.scene.children, true );

		for ( let i = 0; i < intersects.length; i ++ ) {

			if ( intersects !== null && intersects.length > 0 && intersects[ i ].object.type === "Mesh" ) {

				let selectedElement = intersects[ i ].object;

				if ( selectedElement.hoverable === true ) {

					let selectedLayer = this.layers[ selectedElement.layerIndex - 1 ];

					// Let the layer to handle actual hover event.

					selectedLayer.handleHoverIn( selectedElement );

					this.hoveredLayer = selectedLayer;

					break;

				}

			}

		}

	},

	/**
	 * initTSPModel(), call all functions required in model initialization process.
	 */

	initTSPModel: function() {

		this.updateCamera( this.layers.length );
		this.createModelElements();
		this.registerModelEvent();
		this.animate();

		this.isInitialized = true;

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Model.
	 * SubClasses ( specific Model ) override these abstract methods.
	 *
	 * ============
	 */

	/**
	 * add(), add a new TSP layer to sequential model
	 *
	 * Four main task in adding process:
	 * 1. Set previous layer for the new TSP layer.
	 * 2. Config environment for new TSP layer.
	 * 3. Add a TSP layer instance on top of the layer stack.
	 * 4. Assemble new layer, which mean that calculate the layer's shape.
	 *
	 * @param layer, new TSP layer
	 */

	add: function( layer ) {

		// Set last layer for native layer.

		if ( this.layers.length !== 0 ) {

			if ( !layer.isMerged ) {

				let tailLayer = this.layers[ this.layers.length - 1 ];
				layer.setLastLayer( tailLayer );

			}

		}

		// Config environment for new layer.

		layer.setEnvironment( this.scene, this );
		layer.loadModelConfig( this.configuration );

		// Add layer on top of layer stack.

		this.layers.push( layer ) ;

		// Assemble new layer.

		layer.assemble( this.layers.length );

	},

	/**
	 * createModelElements(), get layer configure and init layer elements.
	 *
	 * Three steps:
	 * 1. Calculate layer center position in the scene.
	 * 2. Calculate layer aggregation's depth based on its depth
	 * 3. Call all layers' init
	 */

	createModelElements: function() {

		let layersPos = LayerLocator.calculateLayersPos( this.layers );
		let layerActualDepth = ActualDepthCalculator.calculateDepths( this.layers );

		for ( let i = 0; i < this.layers.length; i ++ ) {

			this.layers[ i ].init( layersPos[ i ], layerActualDepth[ i ] );

		}

	},

	/**
	 * updateVis(), update input layer and other layer separately based on input and prediction result.
	 */

	updateVis: function() {

		// Update input layer's visualization.

		this.updateInputVis();

		// Update other layer's visualization.

		this.updateLayerPredictVis();

	},

	/**
	 * updateInputVis(), update input layer's visualizatiion.
	 */

	updateInputVis: function() {

		if ( this.predictor.multiInputs ) {

			this.layers[ 0 ].updateValue( this.inputValue[ 0 ] );

		} else {

			this.layers[ 0 ].updateValue( this.inputValue );

		}

	},

	/**
	 * updateLayerPredictVis(), update layer's visualization except input layer.
	 */

	updateLayerPredictVis: function() {

		let outputCount = 0;

		for ( let i = 1; i < this.layers.length; i ++ ) {

			if ( !this.layers[ i ].autoOutputDetect ) {

				// Pass the prediction result to layers which need a output value from model.

				let predictValue = this.predictResult[ outputCount ].dataSync();

				this.layers[ i ].updateValue( predictValue );

				outputCount ++;

			} else {

				// Directly call updateValue function without pass a value for autoOutputDetect layer.

				this.layers[ i ].updateValue();

			}

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

let LayerStackGenerator = ( function() {

	function createStack( outputs ) {

		let layers = [];

		for ( let i = 0; i < outputs.length; i ++ ) {

			getRelativeLayers( layers, outputs[ i ] );

		}

		return layers;

	}

	function getRelativeLayers( layers, layer ) {

		storeLayer( layers, layer );

		if ( layer.isMerged ) {

			for ( let i = 0; i < layer.mergedElements.length; i ++ ) {

				getRelativeLayers( layers, layer.mergedElements[ i ] );

			}

		} else {

			if ( layer.lastLayer !== undefined ) {

				getRelativeLayers( layers, layer.lastLayer );

			}

		}

	}

	function storeLayer( layers, layer ) {

		if ( !layers.includes( layer ) ) {

			layers.push( layer );

		}

	}

	return {

		createStack: createStack

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let LevelStackGenerator = ( function() {

	function createStack( layerStack, inputs, outputs ) {

		let relationMatrix = initEmptyRelationMatrix( layerStack.length );

		buildRelationMatrix( relationMatrix, layerStack );

		let layerLevelLookup = initLayerLevelMap( layerStack );

		buildLookupMap(  layerLevelLookup, relationMatrix, layerStack, inputs, outputs  );

		alignOutputs( layerLevelLookup, layerStack, outputs );

		let levelMap = createLevelMap( layerLevelLookup );

		return {

			levelMap : levelMap,
			layerLookupMap: layerLevelLookup

		}

	}

	function initEmptyRelationMatrix( layerNum ) {

		let matrix = new Array( layerNum );

		for ( let i = 0; i < layerNum; i ++ ) {

			matrix[ i ] = new Array( layerNum );

		}

		for ( let i = 0; i < layerNum; i ++ ) {

			for ( let j = 0; j < layerNum; j ++ ) {

				matrix[ i ][ j ] = false;

			}

		}

		return matrix;

	}

	function buildRelationMatrix( relationMatrix, layerStack ) {

		for ( let i = 0; i < layerStack.length; i ++ ) {

			let layer = layerStack[ i ];
			let layerIndex = layerStack.indexOf( layer );

			if ( layer.isMerged ) {

				for ( let j = 0; j < layer.mergedElements.length; j ++ ) {

					let mergedElements = layer.mergedElements[ j ];

					let elementIndexInLayers = layerStack.indexOf( mergedElements );

					relationMatrix[ elementIndexInLayers ][ layerIndex ] = true;

				}

			} else {

				let lastLayer = layer.lastLayer;

				if ( lastLayer !== undefined ) {

					let lastLayerIndex = layerStack.indexOf( lastLayer );

					relationMatrix[ lastLayerIndex ][ layerIndex ] =  true;

				}

			}

		}

	}

	function initLayerLevelMap( layerStack ) {

		let indexMap = [];

		for ( let i = 0; i < layerStack.length; i ++ ) {

			indexMap.push( -1 );

		}

		return indexMap;

	}

	function buildLookupMap( layerLevelLookup, relationMatrix, layerStack, inputs, outputs ) {

		for ( let i = 0; i < inputs.length; i ++ ) {

			let input = inputs[ i ];

			let inputIndex = layerStack.indexOf( input );

			layerLevelLookup[ inputIndex ] = 0;

		}

		let searchLayers = inputs;
		let layerLevel = 0;

		while( !allOutputsLayer( outputs, searchLayers ) ) {

			let newSearchLayers = [];

			for ( let i = 0; i < searchLayers.length; i ++ ) {

				let layer = searchLayers[ i ];
				let layerIndex = layerStack.indexOf( layer );

				for ( let j = 0; j < layerStack.length; j ++ ) {

					if ( relationMatrix[ layerIndex ][ j ] ) {

						layerLevelLookup[ j ] = layerLevel + 1;
						newSearchLayers.push( layerStack[ j ] );

					}

				}

			}

			layerLevel ++;
			searchLayers = newSearchLayers;

		}

	}

	function alignOutputs( layerLevelLookup, layerStack, outputs ) {

		let modelDepth = 0;

		for ( let i = 0; i < layerLevelLookup.length; i ++ ) {

			modelDepth = Math.max( modelDepth, layerLevelLookup[ i ] );

		}

		for ( let i = 0; i < layerStack.length; i ++ ) {

			let layer = layerStack[ i ];

			if ( outputs.includes( layer ) ) {

				layerLevelLookup[ i ] = modelDepth;

			}

		}

	}

	function allOutputsLayer( outputs, searchLayers ) {

		for ( let i = 0; i < searchLayers.length; i ++ ) {

			if ( !outputs.includes( searchLayers[ i ] ) ) {

				return false;

			}

		}

		return true;

	}

	function createLevelMap( layerLevelLookup ) {

		let modelDepth = 0;

		for ( let i = 0; i < layerLevelLookup.length; i ++ ) {

			modelDepth = Math.max( modelDepth, layerLevelLookup[ i ] );

		}

		let levelMap = [];

		for ( let i = 0; i <= modelDepth; i ++ ) {

			levelMap.push( [] );

		}

		for ( let i = 0; i < layerLevelLookup.length; i ++ ) {

			levelMap[ layerLevelLookup[ i ] ].push( i );

		}

		return levelMap;

	}

	return {

		createStack: createStack

	}

} )();

let InLevelAligner = ( function() {

	function getXTranslate( layerList ) {

		let translateList = [];

		let layerLength = layerList.length;

		let layerInterval = 50;

		let layerWidth = 0;

		for ( let i = 0; i < layerList.length; i ++ ) {

			layerWidth += layerList[ i ].getBoundingWidth();

		}

		layerWidth += layerInterval * ( layerList.length - 1 );

		let initX = - layerWidth / 2;

		let previousLength = 0;

		for ( let i = 0; i < layerLength; i ++ ) {

			let xTranslate = initX + previousLength + layerList[ i ].getBoundingWidth() / 2;
			translateList.push( xTranslate );

			previousLength += layerList[ i ].getBoundingWidth() + layerInterval;

		}

		return translateList;

	}

	return {

		getXTranslate: getXTranslate

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * A Model is a directed, acyclic graph.
 *
 * @param container, a DOM element where TSP model will be rendered to.
 * @param config, user's config for Model.
 * @constructor
 */

function Model( container, config ) {

	// "Model" inherits from abstract Model "AbstractModel".

	AbstractModel.call( this, container, config );

	this.inputs = undefined;
	this.outputs = undefined;

	this.outputsOrder = undefined;

	this.levelMap = undefined;
	this.layerLookupMap = undefined;

	this.modelDepth = undefined;

	this.levelCenters = undefined;

	this.modelType = "Model";

	this.loadModelConfig( config );

}

Model.prototype = Object.assign( Object.create( AbstractModel.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class AbstractModel's abstract method
	 *
	 * Sequential overrides AbstractModel's function:
	 * predict, clear, reset, onClick, onMouseMove, initTSPModel
	 *
	 * ============
	 */

	/**
	 * predict(), Generates output predictions for the input sample.
	 *
	 * @param input
	 * @param callback
	 */

	predict: function( input, callback ) {

		this.clear();

		this.inputValue = input;

		if ( this.resource !== undefined ) {

			// If a prediction model has already been loaded into TSP, use predictor to get the prediction result.

			this.predictResult = this.predictor.predict( input );

			// Update all layer's visualization.

			this.updateVis();

		} else {

			// If no prediction model be loaded into TSP, just update the input layer.

			this.updateInputVis();

		}

		if ( callback !== undefined ) {

			callback( this.predictResult[ this.predictResult.length - 1 ].dataSync() );

		}

	},

	/**
	 * clear(), clear all layers' visualization and model's input data.
	 */

	clear: function() {

		if ( this.predictResult !== undefined ) {

			for ( let i = 0; i < this.predictResult.length; i ++ ) {

				tf.dispose( this.predictResult[ i ] );

			}

			this.predictResult = undefined;

		}

		for ( let i = 0; i < this.layers.length; i ++ ) {

			this.layers[ i ].clear();

		}

		this.inputValue = undefined;

	},

	/**
	 * reset(), reset the model.
	 *
	 * Three steps:
	 * 1. clear the layer visualization;
	 * 2. reset TrackballControl;
	 * 3. update camera setting in TSP.
	 */

	// TODO: add rearrange.

	reset: function() {

		this.clear();
		this.cameraControls.reset();
		this.updateCamera();

	},

	/**
	 * onClick(), Handler for move click event.
	 *
	 * @param event
	 */

	onClick: function( event ) {

		let model = this;

		// Use Raycaster to capture clicked element.

		model.raycaster.setFromCamera( model.mouse, model.camera );
		let intersects = model.raycaster.intersectObjects( model.scene.children, true );

		for ( let i = 0; i < intersects.length; i ++ ) {

			if ( intersects !== null && intersects.length > 0 && intersects[ i ].object.type === "Mesh" ) {

				let selectedElement = intersects[ i ].object;

				if ( selectedElement.clickable === true ) {

					// Let the layer to handle actual click event.

					let selectedLayer = this.layers[ selectedElement.layerIndex ];

					selectedLayer.handleClick( selectedElement );

					// Rearrange layer

					let translateTime = selectedLayer.openTime;
					let level = this.layerLookupMap[ selectedElement.layerIndex ];

					model.rearrangeLayerInLevel( level, translateTime );

					break;

				}

			}

		}

	},

	/**
	 * onMouseMove(), Handler for mouse move event.
	 *
	 * @param event
	 */

	onMouseMove: function( event ) {

		// calculate mouse position.

		this.mouse.x = ( ( event.clientX - MouseCaptureHelper.getElementViewLeft( this.sceneArea ) ) / this.sceneArea.clientWidth ) * 2 - 1;
		this.mouse.y = - ( ( event.clientY - MouseCaptureHelper.getElementViewTop( this.sceneArea ) )  / this.sceneArea.clientHeight ) * 2 + 1;

		let model = this;

		if ( model.hoveredLayer !== undefined ) {

			model.hoveredLayer.handleHoverOut();
			model.hoveredLayer = undefined;

		}

		// Use Raycaster to capture hovered element.

		model.raycaster.setFromCamera( model.mouse, model.camera );
		let intersects = model.raycaster.intersectObjects( model.scene.children, true );

		for ( let i = 0; i < intersects.length; i ++ ) {

			if ( intersects !== null && intersects.length > 0 && intersects[ i ].object.type === "Mesh" ) {

				let selectedElement = intersects[ i ].object;

				if ( selectedElement.hoverable === true ) {

					let selectedLayer = this.layers[ selectedElement.layerIndex ];

					// Let the layer to handle actual hover event.

					selectedLayer.handleHoverIn( selectedElement );

					this.hoveredLayer = selectedLayer;

					break;

				}

			}

		}

	},

	/**
	 * initTSPModel(), call all functions required in model initialization process.
	 */

	initTSPModel: function() {

		this.createGraph();
		this.assembleLayers();
		this.updateCamera( this.layers.length );
		this.createModelElements();
		this.registerModelEvent();
		this.animate();

		this.isInitialized = true;

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Model.
	 * SubClasses ( specific Model ) override these abstract methods.
	 *
	 * ============
	 */

	loadModelConfig: function( config ) {

		if ( config.inputs !== undefined ) {

			this.inputs = config.inputs;

		} else {

			console.error( "\"inputs\" is required for Model." );

		}

		if ( config.outputs !== undefined ) {

			this.outputs = config.outputs;

		} else {

			console.error( "\"outputs\" is required for Model." );

		}

		if ( config.outputsOrder !== undefined ) {

			this.outputsOrder = config.outputsOrder;

		} else {

			console.error( "\"outputsOrder\" is required for Model." );

		}

	},

	createGraph: function() {

		this.layers = LayerStackGenerator.createStack( this.outputs );

		let levelMetric = LevelStackGenerator.createStack( this.layers, this.inputs, this.outputs );

		this.levelMap = levelMetric.levelMap;
		this.layerLookupMap = levelMetric.layerLookupMap;

		this.modelDepth = this.levelMap.length;

		this.levelCenters = LayerLocator.calculateLevelCenters( this.modelDepth );

	},

	assembleLayers: function() {

		for ( let i = 0; i < this.levelMap.length; i ++ ) {

			let layerIndexList = this.levelMap[ i ];

			for ( let j = 0; j < layerIndexList.length; j ++ ) {

				let layerIndex = layerIndexList[ j ];

				let layer = this.layers[ layerIndex ];

				layer.setEnvironment( this.scene, this );
				layer.loadModelConfig( this.configuration );
				layer.assemble( layerIndex );

			}

		}

	},

	createModelElements: function() {

		let centers = this.createLayerCenters();

		let depths = ActualDepthCalculator.calculateDepths( this.layers );

		for ( let i = 0; i < this.layers.length; i ++ ) {

			this.layers[ i ].init( centers[ i ], depths[ i ] );

		}

	},

	updateVis: function() {

		this.updateInputVis();
		this.updateLayerVis();

	},

	updateInputVis: function() {

		for ( let i = 0; i < this.inputs.length; i ++ ) {

			this.inputs[ i ].updateVis( this.inputValue[ i ] );

		}

	},

	updateLayerVis: function() {

		for ( let i = 0; i < this.predictResult.length; i ++ ) {

			let layer = this.getLayerByName( this.outputsOrder[ i ] );

			layer.updateVis( this.predictResult[ i ] );

		}

	},

	createLayerCenters: function() {

		let layerCenters = [];

		for ( let i = 0; i < this.layers.length; i ++ ) {

			layerCenters.push( {  } );

		}

		for ( let i = 0; i < this.levelMap.length; i ++ ) {

			let levelLayers = [];

			for ( let j = 0; j < this.levelMap[ i ].length; j ++ ) {

				levelLayers.push( this.layers[ this.levelMap[ i ][ j ] ] );

			}

			let xTranslateList = InLevelAligner.getXTranslate( levelLayers );

			for ( let j = 0; j < this.levelMap[ i ].length; j ++ ) {

				layerCenters[ this.levelMap[ i ][ j ] ] = {

					x: this.levelCenters[i].x + xTranslateList[ j ],
					y: this.levelCenters[i].y,
					z: this.levelCenters[i].z

				};

			}

		}

		return layerCenters;

	},

	rearrangeLayerInLevel: function( level, translateTime ) {

		let layerIndexList = this.levelMap[ level ];

		let levelLayers = [];

		for ( let i = 0; i < layerIndexList.length; i ++ ) {

			levelLayers.push( this.layers[ layerIndexList[ i ] ] );

		}

		let xTranslateList = InLevelAligner.getXTranslate( levelLayers );

		let layerCenters = [];

		for ( let i = 0; i < this.levelMap[ level ].length; i ++ ) {

			layerCenters.push( {

				x: this.levelCenters[ level ].x + xTranslateList[ i ],
				y: this.levelCenters[ level ].y,
				z: this.levelCenters[ level ].z

			} );

		}

		for ( let i = 0; i < levelLayers.length; i ++ ) {

			levelLayers[ i ].translateLayer( layerCenters[ i ], translateTime );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

let QueueGroupTweenFactory = ( function() {

	function openLayer( layer ) {

		let init = {

			ratio: 0

		};
		let end = {

			ratio: 1

		};

		let openTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		openTween.onUpdate( function() {

			for ( let i = 0; i < layer.queueHandlers.length; i ++ ) {

				let tempPos = {

					x: init.ratio * ( layer.openCenterList[ i ].x - layer.closeCenterList[ i ].x ),
					y: init.ratio * ( layer.openCenterList[ i ].y - layer.closeCenterList[ i ].y ),
					z: init.ratio * ( layer.openCenterList[ i ].z - layer.closeCenterList[ i ].z )

				};

				layer.queueHandlers[ i ].updatePos( tempPos );

			}

		} ).onStart( function() {

			layer.disposeAggregationElement();
			layer.initSegregationElements( layer.closeCenterList );

			layer.isWaitOpen = false;
			layer.isOpen = true;

		} ).onComplete( function() {

			layer.initCloseButton();

		} );

		openTween.start();

		layer.isWaitOpen = true;

	}

	function closeLayer( layer ) {

		let init = {

			ratio: 1

		};
		let end = {

			ratio: 0

		};

		let fmTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		fmTween.onUpdate( function() {

			for ( let i = 0; i < layer.queueHandlers.length; i ++ ) {

				let tempPos = {

					x: init.ratio * ( layer.openCenterList[ i ].x - layer.closeCenterList[ i ].x ),
					y: init.ratio * ( layer.openCenterList[ i ].y - layer.closeCenterList[ i ].y ),
					z: init.ratio * ( layer.openCenterList[ i ].z - layer.closeCenterList[ i ].z )

				};

				layer.queueHandlers[ i ].updatePos( tempPos );

			}

		} ).onStart( function() {

			layer.disposeCloseButton();

		} ).onComplete( function() {

			layer.disposeSegregationElements();
			layer.initAggregationElement();

			layer.isWaitClose = false;
			layer.isOpen = false;

		} );

		fmTween.start();

		layer.isWaitClose = true;

	}

	return {

		openLayer: openLayer,

		closeLayer: closeLayer

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let ChannelDataGenerator = ( function() {

	function generateChannelData( rawValue, depth ) {

		let layerOutputValues = [];

		for ( let i = 0; i < depth; i ++ ) {

			let referredIndex = i;

			while ( referredIndex < rawValue.length)  {

				layerOutputValues.push( rawValue[ referredIndex ] );
				referredIndex += depth;

			}

		}

		return layerOutputValues;

	}

	// generate channel average data for aggregation
	function generateMaxAggregationData( rawValue, depth ) {

		let aggregationValue = [];

		for ( let i = 0; i < rawValue.length; i += depth ) {

			let channelSum = 0;

			for ( let j = 0; j < depth; j ++ ) {

				channelSum += rawValue[ i + j ];

			}

			aggregationValue.push( channelSum / depth );

		}

		return aggregationValue;

	}

	// generate channel max data for aggregation
	function generateAverageAggregationData( rawValue, depth ) {

		let aggregationValue = [];

		for ( let i = 0; i < rawValue.length; i += depth ) {

			let max = rawValue[ i ];

			for ( let j = 0; j < depth; j++ ) {

				max = max > rawValue[ i + j ] ? max : rawValue[ i + j ];

			}

			aggregationValue.push( max );

		}

		return aggregationValue;

	}

	function generateAggregationData( rawValue, depth, strategy ) {

		if ( strategy === "average" ) {

			return generateAverageAggregationData( rawValue, depth );

		} else if ( strategy === "max" ) {

			return generateMaxAggregationData( rawValue, depth );

		} else {

			console.error( "Do not support \"aggregationStrategy\": " + strategy + ", use \"average\" or \"max\" max instead." );

		}

	}

	return {

		generateChannelData: generateChannelData,

		generateAggregationData: generateAggregationData

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let ColorUtils = ( function() {

	function getAdjustValues( values, minAlpha ) {

		let max = values[ 0 ], min = values[ 0 ];

		for ( let i = 1; i < values.length; i ++ ) {

			if ( values[ i ] > max ) {

				max = values[i];

			}

			if ( values[ i ] < min ) {

				min = values[ i ];

			}

		}

		let adjustValues = [];
		let distance = max - min;

		for ( let i = 0; i < values.length; i ++ ) {

			if ( distance === 0 ) {

				adjustValues.push( min );

			} else {

				adjustValues.push( ( values[ i ] - min ) / distance );

			}

		}

		for ( let i = 0; i < adjustValues.length; i ++ ) {

			adjustValues[ i ] = minAlpha + adjustValues[ i ] * ( 1 - minAlpha );

		}

		// console.log(adjustValues);

		return adjustValues;

	}

	function getColors( values ) {

		let adjustValues = this.getAdjustValues( values );

		let colorList = [];

		for ( let i = 0; i < adjustValues.length; i ++ ) {

			let rgbTriple = [];

			for ( let j = 0; j < 3; j ++ ) {

				rgbTriple.push( adjustValues[ i ] );

			}

			colorList.push( rgbTriple );

		}

		return colorList;

	}

	return {

		getAdjustValues: getAdjustValues,

		getColors: getColors

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

function GridAggregation( width, unitLength, color, minOpacity ) {

	this.width = width;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.width;
	this.color = color;
	this.minOpacity = minOpacity;

	this.aggregationEntity = undefined;
	this.gridGroup = undefined;

	this.init();

}

GridAggregation.prototype = {

	init: function() {

		let amount = this.width;
		let data = new Uint8Array( amount );
		this.dataArray = data;
		let dataTex = new THREE.DataTexture( data, this.width, 1, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let geometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.unitLength );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial

		];

		let cube = new THREE.Mesh( geometry, materials );

		cube.position.set( 0, 0, 0 );
		cube.elementType = "aggregationElement";
		cube.clickable = true;
		cube.hoverable = true;

		this.aggregationEntity = cube;

		let edgesGeometry = new THREE.EdgesGeometry( geometry );
		let edgesLine = new THREE.LineSegments(

			edgesGeometry,
			new THREE.LineBasicMaterial( { color: FrameColor } )

		);

		let aggregationGroup = new THREE.Object3D();
		aggregationGroup.add( cube );
		aggregationGroup.add( edgesLine );

		this.gridGroup = aggregationGroup;

		this.clear();

	},

	getElement: function() {

		return this.gridGroup;

	},

	setLayerIndex: function( layerIndex ) {

		this.aggregationEntity.layerIndex = layerIndex;

	},

	updateVis: function( colors ) {

		for ( let i = 0; i < colors.length; i++ ) {

			this.dataArray[ i ] = 255 * colors[ i ];

		}

		this.dataTexture.needsUpdate = true;

	},

	clear: function() {

		let zeroValue = new Int8Array( this.width );
		let colors = ColorUtils.getAdjustValues( zeroValue, this.minOpacity );
		this.updateVis( colors );

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

let RenderPreprocessor = ( function() {

	function preProcessMapColor( colors, width, height ) {

		let renderData = [];

		for ( let i = 0; i < height; i ++ ) {

			let dataLine = colors.slice( width * i, width * ( i + 1 ) );
			renderData = dataLine.concat( renderData );

		}

		return renderData;

	}

	function preProcessMap3dColor( colors, width, height ) {

		let renderData = [];

		for ( let i = 0; i < height; i ++ ) {

			let dataLine = colors.slice( 3 * i * width, 3 * ( i + 1 ) * width );
			renderData = dataLine.concat( renderData );

		}

		return renderData;

	}

	function preProcessQueueBackColor( colors ) {

		let renderData = [];

		for ( let i = colors.length - 1; i >= 0; i -- ) {

			renderData.push( colors[ i ] );

		}

		return renderData;

	}

	return {

		preProcessFmColor: preProcessMapColor,

		preProcessChannelColor: preProcessMapColor,

		preProcessPaddingColor: preProcessMapColor,

		preProcessRGBInputColor: preProcessMap3dColor,

		preProcessQueueBackColor: preProcessQueueBackColor

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let fontData = {"glyphs":{"ǻ":{"x_min":64,"x_max":626,"ha":737,"o":"m 308 1166 q 338 1203 322 1182 q 370 1246 354 1224 q 401 1290 386 1268 q 426 1331 415 1311 l 575 1331 l 575 1320 q 542 1283 564 1305 q 495 1236 521 1261 q 441 1190 469 1212 q 389 1153 413 1167 l 308 1153 l 308 1166 m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 522 959 q 510 897 522 924 q 477 850 498 869 q 428 821 456 831 q 366 812 400 812 q 305 821 332 812 q 257 850 277 831 q 226 896 237 869 q 215 958 215 923 q 226 1019 215 992 q 257 1065 237 1046 q 305 1094 277 1084 q 366 1104 332 1104 q 427 1094 399 1104 q 477 1065 456 1084 q 510 1020 498 1046 q 522 959 522 993 m 447 958 q 425 1014 447 994 q 368 1034 403 1034 q 311 1014 333 1034 q 289 958 289 994 q 309 901 289 921 q 368 881 329 881 q 425 901 403 881 q 447 958 447 921 "},"Á":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 362 1089 q 392 1134 376 1108 q 424 1187 408 1160 q 455 1242 440 1215 q 480 1293 469 1269 l 629 1293 l 629 1278 q 596 1233 618 1260 q 549 1175 575 1205 q 495 1118 523 1146 q 444 1071 467 1089 l 362 1071 l 362 1089 "},"ĥ":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 0 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 1055 l 241 1055 l 241 741 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 0 l 583 0 m 655 1109 l 573 1109 q 501 1164 538 1131 q 430 1234 465 1197 q 357 1164 393 1197 q 287 1109 321 1131 l 205 1109 l 205 1127 q 245 1172 222 1146 q 291 1225 268 1198 q 334 1280 314 1253 q 364 1331 354 1307 l 495 1331 q 525 1280 505 1307 q 568 1225 545 1253 q 614 1172 591 1198 q 655 1127 638 1146 l 655 1109 "},"Κ":{"x_min":135,"x_max":804.25,"ha":804,"o":"m 804 0 l 661 0 l 355 473 l 261 396 l 261 0 l 135 0 l 135 992 l 261 992 l 261 496 l 343 609 l 649 992 l 791 992 l 438 559 l 804 0 "},"»":{"x_min":57,"x_max":621.5,"ha":676,"o":"m 621 356 l 411 78 l 333 130 l 494 367 l 333 603 l 411 656 l 621 375 l 621 356 m 345 356 l 136 78 l 57 130 l 218 367 l 57 603 l 136 656 l 345 375 l 345 356 "},"∆":{"x_min":28,"x_max":761,"ha":789,"o":"m 28 76 l 330 992 l 457 992 l 761 75 l 761 0 l 28 0 l 28 76 m 456 625 q 419 748 434 691 q 393 856 403 805 q 367 748 381 805 q 333 629 353 691 l 161 111 l 627 111 l 456 625 "},"ў":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 6 745 l 134 745 l 280 329 q 300 272 290 301 q 318 212 310 242 q 333 154 327 182 q 341 103 339 126 l 346 103 q 356 149 349 120 q 373 211 364 178 q 392 276 382 244 q 409 330 402 308 l 544 745 l 672 745 l 377 -96 q 336 -195 358 -152 q 285 -270 314 -239 q 217 -317 256 -300 q 123 -334 177 -334 q 62 -330 88 -334 q 18 -322 36 -326 l 18 -223 q 54 -229 32 -226 q 99 -231 75 -231 q 156 -223 132 -231 q 197 -201 179 -216 q 227 -164 215 -186 q 250 -115 240 -142 l 289 -6 l 6 745 m 607 1058 q 586 964 602 1005 q 538 897 569 924 q 458 855 506 869 q 342 842 410 842 q 225 855 273 842 q 148 895 177 868 q 104 963 118 922 q 87 1058 90 1003 l 202 1058 q 214 990 205 1016 q 241 949 224 964 q 283 929 258 934 q 345 923 309 923 q 400 930 375 923 q 443 952 425 937 q 473 993 461 968 q 488 1058 484 1019 l 607 1058 "},"ţ":{"x_min":23,"x_max":445,"ha":471,"o":"m 343 88 q 371 89 355 88 q 400 93 386 91 q 426 97 415 95 q 445 102 438 100 l 445 8 q 422 0 436 3 q 392 -7 409 -4 q 358 -12 376 -10 q 324 -14 341 -14 q 246 -3 282 -14 q 184 34 210 7 q 142 106 157 61 q 128 221 128 152 l 128 656 l 23 656 l 23 709 l 128 759 l 180 915 l 251 915 l 251 745 l 439 745 l 439 656 l 251 656 l 251 221 q 272 121 251 155 q 343 88 294 88 m 138 -288 q 154 -246 145 -271 q 171 -191 163 -220 q 185 -135 179 -163 q 194 -85 192 -107 l 317 -85 l 317 -98 q 302 -141 312 -115 q 276 -197 291 -167 q 242 -255 261 -226 q 204 -307 224 -284 l 138 -307 l 138 -288 "},"«":{"x_min":55.5,"x_max":620,"ha":676,"o":"m 55 375 l 264 656 l 344 603 l 183 367 l 344 130 l 264 78 l 55 356 l 55 375 m 331 375 l 541 656 l 620 603 l 459 367 l 620 130 l 541 78 l 331 356 l 331 375 "},"í":{"x_min":118,"x_max":392,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 125 860 q 155 905 139 879 q 187 958 171 931 q 218 1013 203 986 q 243 1064 232 1040 l 392 1064 l 392 1049 q 359 1004 381 1031 q 312 946 338 976 q 258 889 286 917 q 207 842 230 860 l 125 842 l 125 860 "},"ņ":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 0 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 0 l 583 0 m 300 -288 q 316 -246 307 -271 q 333 -191 325 -220 q 347 -135 341 -163 q 356 -85 354 -107 l 479 -85 l 479 -98 q 464 -141 474 -115 q 438 -197 453 -167 q 404 -255 423 -226 q 366 -307 386 -284 l 300 -307 l 300 -288 "},"µ":{"x_min":118,"x_max":706,"ha":825,"o":"m 241 264 q 277 132 241 176 q 388 88 313 88 q 481 106 443 88 q 540 158 518 123 q 573 242 563 192 q 582 357 582 292 l 582 745 l 706 745 l 706 0 l 606 0 l 588 99 l 581 99 q 500 14 548 43 q 381 -14 451 -14 q 296 1 332 -14 q 237 45 261 17 q 239 -7 238 19 q 241 -59 240 -30 q 241 -117 241 -88 l 241 -334 l 118 -334 l 118 745 l 241 745 l 241 264 "},"ỳ":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 6 745 l 134 745 l 280 329 q 300 272 290 301 q 318 212 310 242 q 333 154 327 182 q 341 103 339 126 l 346 103 q 356 149 349 120 q 373 211 364 178 q 392 276 382 244 q 409 330 402 308 l 544 745 l 672 745 l 377 -96 q 336 -195 358 -152 q 285 -270 314 -239 q 217 -317 256 -300 q 123 -334 177 -334 q 62 -330 88 -334 q 18 -322 36 -326 l 18 -223 q 54 -229 32 -226 q 99 -231 75 -231 q 156 -223 132 -231 q 197 -201 179 -216 q 227 -164 215 -186 q 250 -115 240 -142 l 289 -6 l 6 745 m 411 842 l 329 842 q 277 889 305 860 q 223 946 249 917 q 176 1004 197 976 q 144 1049 154 1031 l 144 1064 l 292 1064 q 318 1013 303 1040 q 348 958 332 986 q 380 905 364 931 q 411 860 396 879 l 411 842 "},"Ι":{"x_min":55.34375,"x_max":414.8125,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 "},"Ύ":{"x_min":-18,"x_max":924.25,"ha":925,"o":"m 557 490 l 788 992 l 924 992 l 621 386 l 621 0 l 495 0 l 495 379 l 192 992 l 330 992 l 557 490 m -18 789 q -4 835 -11 809 q 8 889 2 861 q 20 943 15 916 q 29 993 26 970 l 164 993 l 164 978 q 148 936 159 962 q 122 880 137 909 q 89 821 106 850 q 55 771 71 792 l -18 771 l -18 789 "},"ѕ":{"x_min":61.15625,"x_max":564,"ha":627,"o":"m 564 203 q 544 108 564 149 q 487 40 524 68 q 398 0 450 13 q 281 -14 346 -14 q 154 -2 207 -14 q 61 33 101 9 l 61 146 q 107 125 82 135 q 161 106 133 114 q 219 93 189 98 q 279 88 249 88 q 353 95 323 88 q 403 116 384 103 q 431 150 423 130 q 440 194 440 170 q 433 232 440 215 q 409 265 427 249 q 360 299 391 282 q 280 337 329 316 q 193 378 232 358 q 127 424 154 399 q 86 482 100 449 q 72 560 72 515 q 90 645 72 608 q 143 707 109 682 q 224 745 177 732 q 330 758 272 758 q 451 743 396 758 q 554 706 505 729 l 512 606 q 422 641 468 626 q 329 655 376 655 q 228 632 261 655 q 195 568 195 610 q 203 526 195 544 q 229 493 210 509 q 279 461 248 477 q 358 426 311 445 q 444 385 406 405 q 509 339 482 365 q 549 281 535 314 q 564 203 564 249 "},"Ш":{"x_min":135,"x_max":1250,"ha":1385,"o":"m 1250 0 l 135 0 l 135 992 l 261 992 l 261 111 l 629 111 l 629 992 l 755 992 l 755 111 l 1123 111 l 1123 992 l 1250 992 l 1250 0 "},"M":{"x_min":135,"x_max":1074,"ha":1209,"o":"m 544 0 l 253 868 l 248 868 q 255 768 252 818 q 259 678 257 726 q 261 593 261 631 l 261 0 l 135 0 l 135 992 l 331 992 l 601 183 l 605 183 l 886 992 l 1074 992 l 1074 0 l 947 0 l 947 601 q 949 682 947 637 q 952 769 950 728 q 957 867 955 817 l 951 867 l 648 0 l 544 0 "},"Ψ":{"x_min":71,"x_max":994,"ha":1065,"o":"m 994 667 q 985 582 994 625 q 959 499 977 539 q 913 423 942 458 q 844 360 885 387 q 749 318 803 334 q 626 303 694 303 l 594 303 l 594 0 l 468 0 l 468 303 l 436 303 q 314 318 368 303 q 220 359 260 333 q 151 421 179 386 q 105 497 122 456 q 79 580 87 537 q 71 664 71 623 l 71 992 l 204 992 l 204 667 q 219 560 204 607 q 265 479 235 512 q 342 428 295 446 q 450 410 388 410 l 468 410 l 468 992 l 594 992 l 594 410 l 611 410 q 798 477 737 410 q 860 664 860 544 l 860 992 l 994 992 l 994 667 "},"ũ":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 510 843 q 456 854 483 843 q 404 881 430 866 q 354 907 378 895 q 309 919 330 919 q 262 901 278 919 q 236 841 246 883 l 166 841 q 180 915 169 882 q 209 972 191 948 q 252 1008 227 995 q 309 1021 277 1021 q 365 1009 337 1021 q 418 982 392 997 q 467 956 444 968 q 510 944 491 944 q 556 962 541 944 q 582 1022 572 980 l 654 1022 q 639 948 650 981 q 610 892 628 915 q 567 855 592 868 q 510 843 542 843 "},"ŭ":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 612 1030 q 594 954 609 988 q 553 894 579 920 q 490 855 527 869 q 405 842 453 842 q 318 855 355 842 q 257 893 281 868 q 219 952 232 918 q 204 1030 206 987 l 278 1030 q 290 983 281 1000 q 316 957 300 965 q 355 946 332 948 q 408 943 378 943 q 454 946 432 943 q 494 959 476 949 q 523 985 511 968 q 537 1030 534 1002 l 612 1030 "},"―":{"x_min":56,"x_max":1333,"ha":1389,"o":"m 56 315 l 56 429 l 1333 429 l 1333 315 l 56 315 "},"{":{"x_min":41,"x_max":456,"ha":492,"o":"m 338 -10 q 346 -64 338 -43 q 369 -96 354 -84 q 407 -113 385 -108 q 456 -118 428 -117 l 456 -220 q 359 -208 404 -219 q 283 -172 315 -196 q 233 -110 251 -148 q 215 -19 215 -73 l 215 208 q 170 307 215 278 q 41 337 125 337 l 41 439 q 170 468 125 439 q 215 567 215 497 l 215 793 q 233 883 215 846 q 283 944 251 920 q 359 980 315 968 q 456 992 404 991 l 456 890 q 407 885 428 889 q 369 868 385 880 q 346 836 354 857 q 338 783 338 815 l 338 559 q 298 446 338 488 q 180 391 258 405 l 180 383 q 298 328 258 369 q 338 214 338 286 l 338 -10 "},"¼":{"x_min":42,"x_max":962.765625,"ha":1023,"o":"m 207 992 l 297 992 l 297 397 l 201 397 l 201 754 q 201 792 201 771 q 202 833 201 813 q 204 873 203 854 q 206 908 205 893 q 184 881 196 895 q 156 853 171 866 l 92 799 l 42 864 l 207 992 m 815 992 l 264 0 l 157 0 l 708 992 l 815 992 m 962 133 l 877 133 l 877 0 l 781 0 l 781 133 l 526 133 l 526 208 l 782 599 l 877 599 l 877 217 l 962 217 l 962 133 m 781 217 l 781 368 q 782 439 781 400 q 785 515 783 477 q 774 492 781 507 q 760 462 767 478 q 744 430 752 445 q 729 403 736 414 l 622 217 l 781 217 "},"Ḿ":{"x_min":135,"x_max":1074,"ha":1209,"o":"m 544 0 l 253 868 l 248 868 q 255 768 252 818 q 259 678 257 726 q 261 593 261 631 l 261 0 l 135 0 l 135 992 l 331 992 l 601 183 l 605 183 l 886 992 l 1074 992 l 1074 0 l 947 0 l 947 601 q 949 682 947 637 q 952 769 950 728 q 957 867 955 817 l 951 867 l 648 0 l 544 0 m 522 1091 q 552 1136 536 1110 q 584 1189 568 1162 q 615 1244 600 1217 q 640 1295 629 1271 l 789 1295 l 789 1280 q 756 1235 778 1262 q 709 1177 735 1207 q 655 1120 683 1148 q 604 1073 627 1091 l 522 1073 l 522 1091 "},"ι":{"x_min":111,"x_max":428,"ha":454,"o":"m 234 743 l 234 220 q 255 121 234 154 q 326 88 277 88 q 353 89 338 88 q 383 93 368 91 q 409 97 397 95 q 428 102 421 100 l 428 8 q 405 0 419 3 q 375 -7 391 -4 q 341 -12 358 -10 q 307 -14 323 -14 q 229 -3 265 -14 q 167 34 193 7 q 125 105 140 60 q 111 219 111 150 l 111 743 l 234 743 "},"Ĳ":{"x_min":55.34375,"x_max":722.15625,"ha":847,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 451 -264 q 390 -259 416 -264 q 346 -247 364 -255 l 346 -139 q 395 -149 369 -145 q 452 -152 422 -152 q 503 -146 477 -152 q 549 -122 528 -139 q 583 -76 570 -105 q 596 0 596 -46 l 596 992 l 722 992 l 722 13 q 702 -109 722 -57 q 646 -196 682 -162 q 561 -247 611 -230 q 451 -264 511 -264 "},"Ê":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 616 1071 l 534 1071 q 462 1126 499 1093 q 391 1196 426 1159 q 318 1126 354 1159 q 248 1071 282 1093 l 166 1071 l 166 1089 q 206 1134 183 1108 q 252 1187 229 1160 q 295 1242 275 1215 q 325 1293 315 1269 l 456 1293 q 486 1242 466 1269 q 529 1187 506 1215 q 575 1134 552 1160 q 616 1089 599 1108 l 616 1071 "},"Ά":{"x_min":-16,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m -16 789 q -2 835 -9 809 q 10 889 4 861 q 22 943 17 916 q 31 993 28 970 l 166 993 l 166 978 q 150 936 161 962 q 124 880 139 909 q 91 821 108 850 q 57 771 73 792 l -16 771 l -16 789 "},")":{"x_min":42,"x_max":363,"ha":418,"o":"m 363 380 q 350 214 363 296 q 313 57 338 133 q 249 -89 287 -19 q 158 -220 211 -158 l 43 -220 q 126 -84 90 -156 q 186 64 162 -12 q 223 221 211 141 q 235 381 235 301 q 186 704 235 547 q 42 992 137 861 l 158 992 q 249 857 211 928 q 313 708 287 785 q 350 547 338 630 q 363 380 363 465 "},"ε":{"x_min":61,"x_max":583,"ha":629,"o":"m 453 439 l 453 336 l 366 336 q 229 305 273 336 q 184 210 184 274 q 198 152 184 176 q 235 114 212 129 q 291 94 259 100 q 360 88 323 88 q 426 93 395 88 q 484 106 457 98 q 535 125 511 114 q 580 146 559 135 l 580 37 q 486 0 540 14 q 359 -14 433 -14 q 226 2 282 -14 q 133 48 170 19 q 78 117 96 77 q 61 203 61 157 q 73 275 61 245 q 108 326 86 305 q 157 361 129 347 q 215 385 185 375 l 215 392 q 162 416 185 402 q 121 452 138 431 q 94 500 103 473 q 85 561 85 527 q 104 645 85 608 q 159 707 124 682 q 244 745 195 732 q 351 758 293 758 q 417 754 387 758 q 475 745 448 751 q 529 729 503 739 q 583 706 555 720 l 540 606 q 445 642 489 629 q 353 655 401 655 q 240 629 279 655 q 201 551 201 603 q 214 499 201 520 q 252 464 228 477 q 311 445 277 451 q 386 439 345 439 l 453 439 "},"э":{"x_min":37,"x_max":566,"ha":642,"o":"m 218 -14 q 115 -3 157 -14 q 37 26 73 6 l 37 135 q 118 106 73 118 q 219 93 163 93 q 308 107 269 93 q 376 149 348 121 q 420 223 404 178 q 439 331 437 268 l 114 331 l 114 434 l 438 434 q 379 598 429 547 q 234 650 329 650 q 197 647 217 650 q 156 638 176 644 q 116 627 135 633 q 82 614 97 621 l 45 718 q 83 733 62 726 q 130 746 105 741 q 180 754 154 751 q 233 758 207 758 q 363 736 302 758 q 468 669 424 715 q 539 548 513 623 q 566 367 566 474 q 538 196 566 268 q 463 78 511 125 q 352 8 415 31 q 218 -14 289 -14 "},"ш":{"x_min":118,"x_max":1089,"ha":1207,"o":"m 665 102 l 965 102 l 965 745 l 1089 745 l 1089 0 l 118 0 l 118 745 l 241 745 l 241 102 l 542 102 l 542 745 l 665 745 l 665 102 "},"Я":{"x_min":16.75,"x_max":685,"ha":819,"o":"m 391 410 l 165 0 l 16 0 l 275 444 q 204 479 237 458 q 145 533 170 500 q 104 612 119 566 q 90 721 90 658 q 175 923 90 855 q 431 992 261 992 l 685 992 l 685 0 l 558 0 l 558 410 l 391 410 m 558 884 l 432 884 q 343 874 382 884 q 277 843 304 864 q 237 789 251 822 q 223 710 223 756 q 236 630 223 666 q 276 569 249 595 q 342 531 302 544 q 437 517 382 517 l 558 517 l 558 884 "},"a":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 "},"Ę":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 489 -161 q 507 -206 489 -191 q 549 -220 525 -220 q 582 -218 566 -220 q 608 -214 598 -217 l 608 -291 q 568 -299 590 -296 q 527 -302 547 -302 q 425 -266 459 -302 q 392 -170 392 -231 q 401 -116 392 -142 q 427 -69 411 -91 q 460 -30 442 -48 q 496 0 479 -12 l 583 0 q 489 -161 489 -90 "},"Z":{"x_min":56,"x_max":693,"ha":749,"o":"m 693 0 l 56 0 l 56 97 l 537 880 l 70 880 l 70 992 l 679 992 l 679 894 l 197 111 l 693 111 l 693 0 "}," ":{"x_min":0,"x_max":0,"ha":231},"k":{"x_min":118,"x_max":684.25,"ha":689,"o":"m 233 384 l 324 500 l 522 745 l 665 745 l 394 422 l 684 0 l 542 0 l 315 341 l 241 286 l 241 0 l 118 0 l 118 1055 l 241 1055 l 241 571 l 230 384 l 233 384 "},"Ù":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 575 1071 l 493 1071 q 441 1118 469 1089 q 387 1175 413 1146 q 340 1233 361 1205 q 308 1278 318 1260 l 308 1293 l 456 1293 q 482 1242 467 1269 q 512 1187 496 1215 q 544 1134 528 1160 q 575 1089 560 1108 l 575 1071 "},"Ů":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 639 1218 q 627 1156 639 1183 q 594 1109 615 1128 q 545 1080 573 1090 q 483 1071 516 1071 q 421 1080 449 1071 q 373 1109 393 1090 q 342 1155 353 1128 q 332 1217 332 1182 q 342 1278 332 1251 q 373 1324 353 1305 q 421 1353 393 1343 q 483 1363 449 1363 q 544 1353 516 1363 q 594 1324 573 1343 q 627 1279 615 1305 q 639 1218 639 1252 m 564 1217 q 542 1273 564 1253 q 485 1293 520 1293 q 428 1273 450 1293 q 406 1217 406 1253 q 426 1160 406 1180 q 485 1140 446 1140 q 542 1160 520 1140 q 564 1217 564 1180 "},"¢":{"x_min":128,"x_max":647,"ha":765,"o":"m 634 162 q 574 133 605 143 q 498 121 542 123 l 498 -14 l 382 -14 l 382 126 q 276 160 323 134 q 196 230 229 185 q 145 343 163 275 q 128 503 128 410 q 145 668 128 599 q 196 783 163 737 q 276 854 229 829 q 382 889 323 880 l 382 1006 l 498 1006 l 498 894 q 580 880 540 892 q 647 853 620 869 l 611 747 q 576 761 595 754 q 537 772 557 767 q 496 780 516 777 q 459 783 476 783 q 304 715 353 783 q 255 504 255 647 q 304 296 255 362 q 454 231 353 231 q 553 243 509 231 q 634 272 598 256 l 634 162 "},"В":{"x_min":135,"x_max":786,"ha":863,"o":"m 135 992 l 405 992 q 558 978 492 992 q 668 936 624 965 q 735 858 713 906 q 758 740 758 810 q 744 662 758 698 q 707 597 731 625 q 645 551 682 569 q 563 526 609 532 l 563 519 q 650 496 609 511 q 720 454 690 480 q 768 386 751 427 q 786 287 786 345 q 763 166 786 219 q 700 76 741 113 q 598 19 658 39 q 463 0 539 0 l 135 0 l 135 992 m 261 572 l 427 572 q 523 582 485 572 q 586 612 562 592 q 621 662 610 632 q 631 732 631 692 q 579 848 631 813 q 413 884 526 884 l 261 884 l 261 572 m 261 464 l 261 107 l 441 107 q 541 121 500 107 q 606 159 581 134 q 641 217 630 183 q 652 292 652 251 q 641 362 652 330 q 604 416 630 393 q 537 451 579 439 q 433 464 495 464 l 261 464 "},"І":{"x_min":55.34375,"x_max":414.8125,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 "},"ē":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 192 943 l 582 943 l 582 842 l 192 842 l 192 943 "},"β":{"x_min":118,"x_max":774,"ha":836,"o":"m 427 1063 q 548 1046 493 1063 q 643 996 603 1029 q 706 913 683 963 q 729 796 729 863 q 677 637 729 695 q 528 563 625 578 l 528 559 q 711 476 648 544 q 774 281 774 407 q 752 152 774 207 q 690 60 731 97 q 591 4 649 23 q 458 -14 532 -14 q 337 -3 393 -14 q 241 28 282 7 l 241 -334 l 118 -334 l 118 743 q 141 887 118 826 q 205 986 164 947 q 303 1044 246 1025 q 427 1063 360 1063 m 427 960 q 355 950 389 960 q 296 913 321 939 q 256 845 271 888 q 241 737 241 802 l 241 142 q 289 120 263 130 q 344 102 316 110 q 399 92 371 95 q 452 88 427 88 q 544 101 506 88 q 605 141 581 115 q 640 205 629 167 q 650 291 650 243 q 632 385 650 345 q 581 451 614 425 q 504 490 549 477 q 405 502 459 502 l 336 502 l 336 605 l 388 605 q 483 618 443 605 q 550 656 523 632 q 589 715 576 681 q 601 791 601 750 q 588 865 601 834 q 552 918 575 897 q 497 950 529 939 q 427 960 465 960 "},"≠":{"x_min":69,"x_max":696,"ha":765,"o":"m 237 300 l 69 300 l 69 402 l 285 402 l 367 577 l 69 577 l 69 679 l 414 679 l 504 870 l 598 830 l 526 679 l 696 679 l 696 577 l 479 577 l 396 402 l 696 402 l 696 300 l 349 300 l 260 111 l 167 150 l 237 300 "},"‼":{"x_min":100,"x_max":587.265625,"ha":688,"o":"m 543 280 l 461 280 l 427 992 l 577 992 l 543 280 m 415 74 q 421 118 415 100 q 440 147 428 136 q 467 163 451 158 q 501 169 482 169 q 534 163 518 169 q 562 147 550 158 q 580 118 573 136 q 587 74 587 100 q 580 31 587 49 q 562 2 573 13 q 534 -14 550 -9 q 501 -20 518 -20 q 467 -14 482 -20 q 440 2 451 -9 q 421 31 428 13 q 415 74 415 49 m 228 280 l 146 280 l 112 992 l 262 992 l 228 280 m 100 74 q 106 118 100 100 q 125 147 113 136 q 152 163 136 158 q 186 169 167 169 q 219 163 203 169 q 247 147 235 158 q 265 118 258 136 q 272 74 272 100 q 265 31 272 49 q 247 2 258 13 q 219 -14 235 -9 q 186 -20 203 -20 q 152 -14 167 -20 q 125 2 136 -9 q 106 31 113 13 q 100 74 100 49 "},"¥":{"x_min":20,"x_max":751,"ha":765,"o":"m 384 490 l 621 992 l 751 992 l 490 471 l 652 471 l 652 363 l 448 363 l 448 271 l 652 271 l 652 163 l 448 163 l 448 0 l 322 0 l 322 163 l 118 163 l 118 271 l 322 271 l 322 363 l 118 363 l 118 471 l 276 471 l 20 992 l 150 992 l 384 490 "},"Ĥ":{"x_min":135,"x_max":839,"ha":974,"o":"m 839 0 l 712 0 l 712 462 l 261 462 l 261 0 l 135 0 l 135 992 l 261 992 l 261 574 l 712 574 l 712 992 l 839 992 l 839 0 m 712 1071 l 630 1071 q 558 1126 595 1093 q 487 1196 522 1159 q 414 1126 450 1159 q 344 1071 378 1093 l 262 1071 l 262 1089 q 302 1134 279 1108 q 348 1187 325 1160 q 391 1242 371 1215 q 421 1293 411 1269 l 552 1293 q 582 1242 562 1269 q 625 1187 602 1215 q 671 1134 648 1160 q 712 1089 695 1108 l 712 1071 "},"U":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 "},"Ñ":{"x_min":135,"x_max":878,"ha":1013,"o":"m 878 0 l 724 0 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 757 174 l 762 174 q 757 276 759 226 q 755 321 756 298 q 753 366 754 343 q 752 410 752 389 q 751 449 751 431 l 751 992 l 878 992 l 878 0 m 614 1072 q 560 1083 587 1072 q 508 1110 534 1095 q 458 1136 482 1124 q 413 1148 434 1148 q 366 1130 382 1148 q 340 1070 350 1112 l 270 1070 q 284 1144 273 1111 q 313 1201 295 1177 q 356 1237 331 1224 q 413 1250 381 1250 q 469 1238 441 1250 q 522 1211 496 1226 q 571 1185 548 1197 q 614 1173 595 1173 q 660 1191 645 1173 q 686 1251 676 1209 l 758 1251 q 743 1177 754 1210 q 714 1121 732 1144 q 671 1084 696 1097 q 614 1072 646 1072 "},"F":{"x_min":135,"x_max":649,"ha":682,"o":"m 261 0 l 135 0 l 135 992 l 649 992 l 649 880 l 261 880 l 261 531 l 623 531 l 623 419 l 261 419 l 261 0 "},"ϑ":{"x_min":7.125,"x_max":815.203125,"ha":834,"o":"m 594 664 q 566 793 585 736 q 521 888 547 850 q 464 948 495 927 q 401 968 433 968 q 321 939 350 968 q 292 861 292 909 q 307 788 292 824 q 359 726 323 753 q 452 681 394 698 q 594 664 509 664 m 722 575 q 724 540 723 560 q 725 499 725 520 q 703 296 725 390 q 637 133 681 202 q 527 25 594 64 q 372 -14 461 -14 q 247 4 297 -14 q 169 55 198 23 q 128 129 140 87 q 117 218 117 172 q 120 277 117 245 q 127 338 123 308 q 134 394 131 368 q 138 435 138 419 q 127 477 138 466 q 95 488 117 488 q 61 483 79 488 q 32 471 43 478 l 7 560 q 66 581 32 572 q 136 591 100 591 q 194 581 171 591 q 233 555 218 572 q 255 515 248 538 q 261 465 261 492 q 258 412 261 441 q 250 351 254 383 q 243 287 247 320 q 240 224 240 254 q 247 170 240 195 q 270 127 254 145 q 313 98 287 109 q 379 88 340 88 q 546 192 490 88 q 601 503 601 296 q 600 540 601 519 q 598 575 600 561 q 398 601 480 576 q 265 667 316 626 q 191 759 214 707 q 169 865 169 810 q 182 947 169 909 q 222 1012 195 985 q 293 1055 250 1040 q 396 1071 336 1071 q 521 1042 466 1071 q 615 961 576 1014 q 680 833 655 908 q 718 664 706 757 l 815 664 l 815 575 l 722 575 "},"Ќ":{"x_min":135,"x_max":804.25,"ha":804,"o":"m 804 0 l 655 0 l 261 502 l 261 0 l 135 0 l 135 992 l 261 992 l 261 511 l 644 992 l 784 992 l 401 515 l 804 0 m 359 1089 q 389 1134 373 1108 q 421 1187 405 1160 q 452 1242 437 1215 q 477 1293 466 1269 l 626 1293 l 626 1278 q 593 1233 615 1260 q 546 1175 572 1205 q 492 1118 520 1146 q 441 1071 464 1089 l 359 1071 l 359 1089 "},"å":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 531 989 q 519 927 531 954 q 486 880 507 899 q 437 851 465 861 q 375 842 408 842 q 313 851 341 842 q 265 880 285 861 q 234 926 245 899 q 224 988 224 953 q 234 1049 224 1022 q 265 1095 245 1076 q 313 1124 285 1114 q 375 1134 341 1134 q 436 1124 408 1134 q 486 1095 465 1114 q 519 1050 507 1076 q 531 989 531 1023 m 456 988 q 434 1044 456 1024 q 377 1064 412 1064 q 320 1044 342 1064 q 298 988 298 1024 q 318 931 298 951 q 377 911 338 911 q 434 931 412 911 q 456 988 456 951 "},"Ϋ":{"x_min":-0.25,"x_max":731.25,"ha":732,"o":"m 364 490 l 595 992 l 731 992 l 428 386 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 364 490 m 174 1174 q 192 1227 174 1211 q 239 1244 211 1244 q 285 1227 265 1244 q 304 1174 304 1210 q 285 1121 304 1138 q 239 1105 265 1105 q 192 1121 211 1105 q 174 1174 174 1138 m 428 1174 q 447 1227 428 1211 q 493 1244 466 1244 q 518 1239 506 1244 q 539 1227 530 1235 q 553 1206 548 1218 q 559 1174 559 1193 q 539 1121 559 1138 q 493 1105 519 1105 q 447 1121 466 1105 q 428 1174 428 1138 "},"0":{"x_min":66,"x_max":700,"ha":765,"o":"m 700 496 q 682 281 700 376 q 627 121 665 186 q 528 20 588 55 q 381 -14 467 -14 q 242 20 301 -14 q 143 121 182 55 q 85 281 104 186 q 66 496 66 376 q 83 711 66 616 q 138 872 100 806 q 236 972 175 937 q 381 1007 296 1007 q 522 972 462 1007 q 621 873 581 938 q 680 712 660 807 q 700 496 700 617 m 191 497 q 201 319 191 395 q 234 192 211 243 q 292 116 256 142 q 381 91 329 91 q 470 116 433 91 q 530 191 506 141 q 564 318 553 241 q 574 497 574 394 q 564 675 574 599 q 530 801 553 751 q 470 876 506 851 q 381 901 433 901 q 292 876 329 901 q 234 801 256 851 q 201 675 211 751 q 191 497 191 599 "},"ō":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 206 943 l 596 943 l 596 842 l 206 842 l 206 943 "},"”":{"x_min":16,"x_max":489,"ha":504,"o":"m 219 992 l 228 977 q 205 898 218 939 q 176 815 192 857 q 143 731 160 772 q 108 652 125 690 l 16 652 q 38 737 26 692 q 60 827 49 782 q 79 913 70 871 q 94 992 88 956 l 219 992 m 480 992 l 489 977 q 466 898 479 939 q 437 815 453 857 q 404 731 421 772 q 369 652 386 690 l 277 652 q 299 737 287 692 q 321 827 310 782 q 340 913 331 871 q 355 992 349 956 l 480 992 "},"ö":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 204 945 q 222 998 204 982 q 269 1015 241 1015 q 315 998 295 1015 q 334 945 334 981 q 315 892 334 909 q 269 876 295 876 q 222 892 241 876 q 204 945 204 909 m 458 945 q 477 998 458 982 q 523 1015 496 1015 q 548 1010 536 1015 q 569 998 560 1006 q 583 977 578 989 q 589 945 589 964 q 569 892 589 909 q 523 876 549 876 q 477 892 496 876 q 458 945 458 909 "},"ć":{"x_min":77,"x_max":596,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 253 581 302 650 q 204 369 204 513 q 253 160 204 226 q 402 93 302 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 m 316 860 q 346 905 330 879 q 378 958 362 931 q 409 1013 394 986 q 434 1064 423 1040 l 583 1064 l 583 1049 q 550 1004 572 1031 q 503 946 529 976 q 449 889 477 917 q 398 842 421 860 l 316 842 l 316 860 "},"þ":{"x_min":118,"x_max":737,"ha":814,"o":"m 241 644 q 276 688 257 667 q 322 724 296 709 q 381 748 348 739 q 454 758 413 758 q 570 733 518 758 q 659 660 622 709 q 716 540 696 612 q 737 373 737 468 q 716 205 737 277 q 659 84 696 133 q 570 10 622 35 q 454 -14 518 -14 q 381 -5 414 -14 q 323 18 349 3 q 277 52 297 32 q 241 93 257 72 l 233 93 q 237 49 235 70 q 240 13 238 32 q 241 -16 241 -5 l 241 -334 l 118 -334 l 118 1055 l 241 1055 l 241 744 l 236 644 l 241 644 m 430 655 q 343 639 379 655 q 285 592 307 624 q 253 513 263 560 q 241 401 242 465 l 241 373 q 250 251 241 304 q 281 162 259 198 q 340 107 303 125 q 431 88 377 88 q 566 162 523 88 q 609 374 609 236 q 566 585 609 515 q 430 655 523 655 "},"]":{"x_min":35,"x_max":310,"ha":421,"o":"m 35 -118 l 186 -118 l 186 890 l 35 890 l 35 992 l 310 992 l 310 -220 l 35 -220 l 35 -118 "},"А":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 "},"′":{"x_min":90,"x_max":223.609375,"ha":314,"o":"m 223 992 l 195 634 l 117 634 l 90 992 l 223 992 "},"Ы":{"x_min":135,"x_max":1008,"ha":1143,"o":"m 729 290 q 708 170 729 224 q 645 79 688 117 q 537 20 602 41 q 380 0 471 0 l 135 0 l 135 992 l 261 992 l 261 574 l 362 574 q 536 551 465 574 q 648 490 606 529 q 710 400 691 452 q 729 290 729 349 m 261 107 l 368 107 q 540 152 485 107 q 595 290 595 197 q 579 370 595 337 q 533 424 564 403 q 456 453 503 444 q 347 462 410 462 l 261 462 l 261 107 m 881 0 l 881 992 l 1008 992 l 1008 0 l 881 0 "},"ẁ":{"x_min":13.75,"x_max":1022.25,"ha":1036,"o":"m 683 0 l 570 417 q 563 445 567 430 q 555 477 559 460 q 546 512 551 494 q 538 546 542 529 q 518 628 528 586 l 514 628 q 496 546 505 585 q 480 476 488 512 q 464 415 471 440 l 347 0 l 204 0 l 13 745 l 143 745 l 232 348 q 245 282 239 318 q 258 211 252 246 q 269 146 264 177 q 277 95 274 115 l 281 95 q 290 142 284 113 q 303 205 296 172 q 317 270 310 238 q 331 324 325 302 l 453 745 l 586 745 l 702 324 q 716 270 709 301 q 732 207 724 239 q 745 145 739 175 q 754 95 751 115 l 758 95 q 764 142 760 113 q 775 207 769 172 q 788 279 781 242 q 803 348 795 316 l 896 745 l 1022 745 l 829 0 l 683 0 m 585 842 l 503 842 q 451 889 479 860 q 397 946 423 917 q 350 1004 371 976 q 318 1049 328 1031 l 318 1064 l 466 1064 q 492 1013 477 1040 q 522 958 506 986 q 554 905 538 931 q 585 860 570 879 l 585 842 "},"ĭ":{"x_min":-23,"x_max":385,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 385 1030 q 367 954 382 988 q 326 894 352 920 q 263 855 300 869 q 178 842 226 842 q 91 855 128 842 q 30 893 54 868 q -7 952 5 918 q -23 1030 -20 987 l 51 1030 q 63 983 54 1000 q 89 957 73 965 q 128 946 105 948 q 181 943 151 943 q 227 946 205 943 q 267 959 249 949 q 296 985 284 968 q 310 1030 307 1002 l 385 1030 "},"8":{"x_min":72,"x_max":694,"ha":765,"o":"m 383 1007 q 490 992 440 1007 q 579 947 540 977 q 639 873 617 917 q 662 768 662 828 q 648 686 662 723 q 610 620 634 650 q 554 568 587 591 q 483 525 521 544 q 561 478 523 504 q 628 420 598 453 q 675 348 657 388 q 694 258 694 308 q 671 145 694 196 q 607 59 648 94 q 509 5 566 24 q 383 -14 452 -14 q 250 4 308 -14 q 152 57 192 22 q 92 141 113 91 q 72 253 72 190 q 87 344 72 304 q 128 418 102 385 q 189 476 154 451 q 264 520 225 501 q 202 566 231 541 q 151 621 172 590 q 117 688 130 651 q 105 770 105 725 q 127 873 105 829 q 188 947 150 917 q 277 992 227 977 q 383 1007 328 1007 m 191 253 q 202 187 191 217 q 236 136 213 157 q 295 102 259 114 q 379 91 330 91 q 464 102 427 91 q 525 136 500 114 q 562 189 550 158 q 574 258 574 220 q 561 322 574 293 q 523 374 547 350 q 463 420 498 399 q 385 463 428 442 l 364 472 q 235 379 278 432 q 191 253 191 327 m 381 901 q 266 866 309 901 q 224 762 224 830 q 236 696 224 724 q 269 647 248 669 q 320 609 290 626 q 384 576 349 592 q 446 608 417 590 q 496 647 475 625 q 530 698 518 670 q 542 762 542 726 q 499 866 542 830 q 381 901 456 901 "},"R":{"x_min":135,"x_max":803.25,"ha":819,"o":"m 261 410 l 261 0 l 135 0 l 135 992 l 376 992 q 642 922 556 992 q 729 710 729 852 q 712 607 729 651 q 668 531 695 563 q 605 479 640 500 q 533 444 570 458 l 803 0 l 654 0 l 416 410 l 261 410 m 261 517 l 371 517 q 473 529 431 517 q 543 564 516 541 q 582 623 570 588 q 595 704 595 658 q 581 787 595 753 q 540 842 567 821 q 469 874 512 864 q 368 884 426 884 l 261 884 l 261 517 "},"Ż":{"x_min":56,"x_max":693,"ha":749,"o":"m 693 0 l 56 0 l 56 97 l 537 880 l 70 880 l 70 992 l 679 992 l 679 894 l 197 111 l 693 111 l 693 0 m 310 1174 q 330 1233 310 1215 q 381 1252 351 1252 q 410 1247 396 1252 q 433 1233 423 1243 q 448 1209 442 1224 q 454 1174 454 1195 q 433 1116 454 1135 q 381 1097 411 1097 q 330 1115 351 1097 q 310 1174 310 1134 "},"ħ":{"x_min":12.1875,"x_max":707,"ha":818,"o":"m 583 0 l 583 451 q 547 583 583 539 q 436 627 512 627 q 343 609 381 627 q 283 557 306 592 q 251 473 261 523 q 241 357 241 422 l 241 0 l 118 0 l 118 843 l 12 843 l 12 932 l 118 932 l 118 1055 l 241 1055 l 241 932 l 498 932 l 498 843 l 241 843 l 241 715 l 236 616 l 242 616 q 283 666 259 645 q 334 702 306 687 q 393 723 362 716 q 457 730 424 730 q 644 665 581 730 q 707 458 707 600 l 707 0 l 583 0 "},"õ":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 499 843 q 445 854 472 843 q 393 881 419 866 q 343 907 367 895 q 298 919 319 919 q 251 901 267 919 q 225 841 235 883 l 155 841 q 169 915 158 882 q 198 972 180 948 q 241 1008 216 995 q 298 1021 266 1021 q 354 1009 326 1021 q 407 982 381 997 q 456 956 433 968 q 499 944 480 944 q 545 962 530 944 q 571 1022 561 980 l 643 1022 q 628 948 639 981 q 599 892 617 915 q 556 855 581 868 q 499 843 531 843 "},"˙":{"x_min":109,"x_max":253.46875,"ha":359,"o":"m 109 945 q 129 1004 109 986 q 180 1023 150 1023 q 209 1018 195 1023 q 232 1004 222 1014 q 247 980 241 995 q 253 945 253 966 q 232 887 253 906 q 180 868 210 868 q 129 886 150 868 q 109 945 109 905 "},"ê":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 602 842 l 520 842 q 448 897 485 864 q 377 967 412 930 q 304 897 340 930 q 234 842 268 864 l 152 842 l 152 860 q 192 905 169 879 q 238 958 215 931 q 281 1013 261 986 q 311 1064 301 1040 l 442 1064 q 472 1013 452 1040 q 515 958 492 986 q 561 905 538 931 q 602 860 585 879 l 602 842 "},"″":{"x_min":90,"x_max":468.609375,"ha":558,"o":"m 223 992 l 195 634 l 117 634 l 90 992 l 223 992 m 468 992 l 440 634 l 362 634 l 335 992 l 468 992 "},"„":{"x_min":43,"x_max":517,"ha":608,"o":"m 246 161 l 256 145 q 233 67 246 108 q 204 -15 220 26 q 170 -99 188 -57 q 136 -179 153 -141 l 43 -179 q 66 -92 54 -137 q 88 -3 77 -48 q 107 82 98 40 q 122 161 116 125 l 246 161 m 508 161 l 517 145 q 494 67 507 108 q 465 -15 481 26 q 432 -99 449 -57 q 397 -179 414 -141 l 305 -179 q 327 -92 315 -137 q 349 -3 338 -48 q 368 82 359 40 q 383 161 377 125 l 508 161 "},"ч":{"x_min":104,"x_max":693,"ha":811,"o":"m 227 745 l 227 466 q 352 348 227 348 q 410 353 382 348 q 462 368 437 358 q 514 392 488 377 q 569 427 541 407 l 569 745 l 693 745 l 693 0 l 569 0 l 569 332 q 512 295 539 311 q 456 268 485 279 q 395 251 427 257 q 324 246 363 246 q 230 261 271 246 q 161 306 188 277 q 118 373 133 334 q 104 458 104 412 l 104 745 l 227 745 "},"δ":{"x_min":75,"x_max":725,"ha":802,"o":"m 360 635 q 291 683 322 657 q 236 737 259 708 q 201 800 214 767 q 189 872 189 833 q 206 956 189 921 q 254 1016 223 992 q 328 1051 286 1039 q 421 1063 370 1063 q 505 1056 467 1063 q 576 1038 543 1049 q 636 1015 609 1028 q 687 989 663 1001 l 637 890 q 590 916 615 903 q 538 938 565 928 q 479 954 510 948 q 413 960 448 960 q 364 952 385 960 q 331 933 344 945 q 311 904 317 920 q 305 869 305 887 q 314 823 305 844 q 344 781 324 802 q 398 738 364 760 q 479 689 431 716 q 583 619 537 655 q 660 539 629 582 q 708 447 691 496 q 725 337 725 397 q 701 185 725 251 q 635 75 678 120 q 531 8 592 31 q 397 -14 471 -14 q 268 6 327 -14 q 166 67 209 27 q 99 164 123 106 q 75 296 75 222 q 97 423 75 368 q 159 520 120 479 q 249 590 197 562 q 360 635 301 618 m 597 325 q 587 410 597 372 q 557 478 577 448 q 510 533 538 508 q 446 579 482 557 q 363 548 407 568 q 284 495 320 528 q 225 413 249 462 q 202 294 202 363 q 215 211 202 249 q 253 146 228 173 q 314 103 278 118 q 395 88 350 88 q 545 149 492 88 q 597 325 597 210 "},"Â":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 647 1071 l 565 1071 q 493 1126 530 1093 q 422 1196 457 1159 q 349 1126 385 1159 q 279 1071 313 1093 l 197 1071 l 197 1089 q 237 1134 214 1108 q 283 1187 260 1160 q 326 1242 306 1215 q 356 1293 346 1269 l 487 1293 q 517 1242 497 1269 q 560 1187 537 1215 q 606 1134 583 1160 q 647 1089 630 1108 l 647 1071 "},"Į":{"x_min":55.34375,"x_max":414.8125,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 224 -161 q 242 -206 224 -191 q 284 -220 260 -220 q 317 -218 301 -220 q 343 -214 333 -217 l 343 -291 q 303 -299 325 -296 q 262 -302 282 -302 q 160 -266 194 -302 q 127 -170 127 -231 q 136 -116 127 -142 q 162 -69 146 -91 q 195 -30 177 -48 q 231 0 214 -12 l 318 0 q 224 -161 224 -90 "},"ω":{"x_min":77,"x_max":970,"ha":1046,"o":"m 332 -14 q 223 13 271 -14 q 143 91 176 41 q 93 209 110 140 q 77 360 77 278 q 82 464 77 415 q 97 558 87 512 q 124 650 108 604 q 162 745 140 696 l 289 745 q 251 649 267 695 q 225 558 235 604 q 209 464 214 512 q 204 360 204 416 q 214 243 204 294 q 242 158 224 192 q 285 106 260 123 q 340 88 310 88 q 394 102 371 88 q 432 140 417 116 q 454 198 447 165 q 462 270 462 231 l 462 478 l 585 478 l 585 270 q 618 135 585 182 q 706 88 651 88 q 761 106 736 88 q 804 158 786 123 q 832 243 823 192 q 842 360 842 294 q 837 464 842 416 q 821 558 832 512 q 795 649 811 604 q 757 745 779 695 l 884 745 q 922 650 906 696 q 949 558 938 604 q 964 464 959 512 q 970 360 970 415 q 953 209 970 278 q 903 91 936 140 q 823 13 871 41 q 714 -14 775 -14 q 595 15 642 -14 q 527 106 548 45 l 520 106 q 452 15 499 45 q 332 -14 404 -14 "},"Ţ":{"x_min":14,"x_max":706,"ha":721,"o":"m 423 0 l 297 0 l 297 880 l 14 880 l 14 992 l 706 992 l 706 880 l 423 880 l 423 0 m 244 -288 q 260 -246 251 -271 q 277 -191 269 -220 q 291 -135 285 -163 q 300 -85 298 -107 l 423 -85 l 423 -98 q 408 -141 418 -115 q 382 -197 397 -167 q 348 -255 367 -226 q 310 -307 330 -284 l 244 -307 l 244 -288 "},"´":{"x_min":267,"x_max":534,"ha":802,"o":"m 267 860 q 297 905 281 879 q 329 958 313 931 q 360 1013 345 986 q 385 1064 374 1040 l 534 1064 l 534 1049 q 501 1004 523 1031 q 454 946 480 976 q 400 889 428 917 q 349 842 372 860 l 267 842 l 267 860 "},"Ĉ":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 406 867 465 894 q 305 788 347 839 q 241 662 264 736 q 218 496 218 588 q 238 326 218 400 q 298 200 258 251 q 398 123 338 150 q 538 97 458 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 m 747 1071 l 665 1071 q 593 1126 630 1093 q 522 1196 557 1159 q 449 1126 485 1159 q 379 1071 413 1093 l 297 1071 l 297 1089 q 337 1134 314 1108 q 383 1187 360 1160 q 426 1242 406 1215 q 456 1293 446 1269 l 587 1293 q 617 1242 597 1269 q 660 1187 637 1215 q 706 1134 683 1160 q 747 1089 730 1108 l 747 1071 "},"И":{"x_min":136,"x_max":879,"ha":1013,"o":"m 136 992 l 262 992 l 262 449 q 261 410 262 431 q 260 366 261 389 q 259 321 260 343 q 257 276 258 298 q 251 174 254 226 l 256 174 l 725 992 l 879 992 l 879 0 l 752 0 l 752 538 q 754 624 752 576 q 759 717 756 673 q 765 821 762 768 l 760 821 l 289 0 l 136 0 l 136 992 "},"Љ":{"x_min":0,"x_max":1193,"ha":1264,"o":"m 1193 290 q 1172 170 1193 224 q 1109 79 1152 117 q 1000 20 1066 41 q 843 0 934 0 l 625 0 l 625 880 l 431 880 q 410 721 420 804 q 388 558 399 638 q 366 406 377 478 q 343 279 354 334 q 310 154 329 209 q 262 61 291 99 q 194 4 234 24 q 98 -16 154 -16 q 46 -10 73 -16 q 0 1 20 -5 l 0 111 q 35 97 15 102 q 76 91 54 91 q 129 113 108 91 q 164 167 150 134 q 187 239 179 200 q 204 315 196 279 q 223 421 213 354 q 247 577 234 488 q 275 771 261 665 q 305 992 290 877 l 751 992 l 751 574 l 825 574 q 999 551 928 574 q 1112 490 1069 529 q 1174 400 1155 452 q 1193 290 1193 349 m 751 107 l 831 107 q 1004 152 948 107 q 1059 290 1059 197 q 1043 370 1059 337 q 997 424 1028 403 q 920 453 966 444 q 810 462 873 462 l 751 462 l 751 107 "},"р":{"x_min":118,"x_max":737,"ha":814,"o":"m 454 -14 q 381 -5 414 -14 q 323 18 349 3 q 277 52 297 32 q 241 93 257 72 l 233 93 q 237 49 235 70 q 240 13 238 32 q 241 -16 241 -5 l 241 -334 l 118 -334 l 118 745 l 218 745 l 236 644 l 241 644 q 276 688 257 667 q 322 724 296 709 q 381 748 348 739 q 454 758 413 758 q 570 733 518 758 q 659 660 622 709 q 716 540 696 612 q 737 373 737 468 q 716 205 737 277 q 659 84 696 133 q 570 10 622 35 q 454 -14 518 -14 m 430 655 q 343 639 379 655 q 285 592 307 624 q 253 513 263 560 q 241 401 242 465 l 241 373 q 250 251 241 304 q 281 162 259 198 q 340 107 303 125 q 431 88 377 88 q 566 162 523 88 q 609 374 609 236 q 566 585 609 515 q 430 655 523 655 "},"Ω":{"x_min":53.0625,"x_max":980.9375,"ha":1031,"o":"m 517 895 q 384 872 439 895 q 292 805 328 849 q 239 699 256 762 q 222 556 222 636 q 234 425 222 488 q 273 304 246 362 q 345 194 301 246 q 455 99 390 143 l 455 0 l 53 0 l 53 111 l 321 111 q 229 189 271 143 q 155 292 186 235 q 106 416 124 349 q 89 559 89 484 q 116 743 89 661 q 198 884 143 826 q 332 975 252 943 q 517 1007 412 1007 q 701 975 622 1007 q 835 884 781 943 q 917 743 890 826 q 945 559 945 661 q 927 416 945 484 q 878 292 909 349 q 805 189 847 235 q 712 111 762 143 l 980 111 l 980 0 l 579 0 l 579 99 q 688 194 643 143 q 760 304 732 246 q 799 425 787 362 q 811 556 811 488 q 794 699 811 636 q 741 805 777 762 q 649 872 705 849 q 517 895 594 895 "},"т":{"x_min":28,"x_max":584,"ha":612,"o":"m 584 642 l 367 642 l 367 0 l 244 0 l 244 642 l 28 642 l 28 745 l 584 745 l 584 642 "},"П":{"x_min":135,"x_max":826,"ha":960,"o":"m 826 0 l 699 0 l 699 880 l 261 880 l 261 0 l 135 0 l 135 992 l 826 992 l 826 0 "},"Ö":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 323 1174 q 341 1227 323 1211 q 388 1244 360 1244 q 434 1227 414 1244 q 453 1174 453 1210 q 434 1121 453 1138 q 388 1105 414 1105 q 341 1121 360 1105 q 323 1174 323 1138 m 577 1174 q 596 1227 577 1211 q 642 1244 615 1244 q 667 1239 655 1244 q 688 1227 679 1235 q 702 1206 697 1218 q 708 1174 708 1193 q 688 1121 708 1138 q 642 1105 668 1105 q 596 1121 615 1105 q 577 1174 577 1138 "},"z":{"x_min":56,"x_max":556.21875,"ha":612,"o":"m 556 0 l 56 0 l 56 80 l 418 656 l 78 656 l 78 745 l 544 745 l 544 650 l 189 88 l 556 88 l 556 0 "},"™":{"x_min":25,"x_max":922,"ha":1040,"o":"m 244 503 l 158 503 l 158 918 l 25 918 l 25 992 l 379 992 l 379 918 l 244 918 l 244 503 m 636 503 l 511 875 l 506 875 q 508 852 507 864 q 509 831 508 841 q 509 812 509 821 q 510 800 510 804 l 510 503 l 424 503 l 424 992 l 552 992 l 673 618 l 801 992 l 922 992 l 922 503 l 835 503 l 835 793 q 836 809 835 799 q 836 831 836 819 q 837 855 837 843 q 838 875 837 867 l 834 875 l 703 503 l 636 503 "},"Θ":{"x_min":85,"x_max":945,"ha":1031,"o":"m 334 560 l 696 560 l 696 452 l 334 452 l 334 560 m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 "},"Ř":{"x_min":135,"x_max":803.25,"ha":819,"o":"m 261 410 l 261 0 l 135 0 l 135 992 l 376 992 q 642 922 556 992 q 729 710 729 852 q 712 607 729 651 q 668 531 695 563 q 605 479 640 500 q 533 444 570 458 l 803 0 l 654 0 l 416 410 l 261 410 m 261 517 l 371 517 q 473 529 431 517 q 543 564 516 541 q 582 623 570 588 q 595 704 595 658 q 581 787 595 753 q 540 842 567 821 q 469 874 512 864 q 368 884 426 884 l 261 884 l 261 517 m 635 1274 q 594 1229 618 1255 q 548 1176 571 1203 q 505 1121 525 1148 q 475 1071 485 1094 l 344 1071 q 314 1121 334 1094 q 271 1176 294 1148 q 225 1229 248 1203 q 185 1274 202 1255 l 185 1293 l 267 1293 q 337 1237 301 1270 q 410 1166 373 1204 q 481 1237 445 1204 q 553 1293 518 1270 l 635 1293 l 635 1274 "},"Ň":{"x_min":135,"x_max":878,"ha":1013,"o":"m 878 0 l 724 0 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 757 174 l 762 174 q 757 276 759 226 q 755 321 756 298 q 753 366 754 343 q 752 410 752 389 q 751 449 751 431 l 751 992 l 878 992 l 878 0 m 732 1274 q 691 1229 715 1255 q 645 1176 668 1203 q 602 1121 622 1148 q 572 1071 582 1094 l 441 1071 q 411 1121 431 1094 q 368 1176 391 1148 q 322 1229 345 1203 q 282 1274 299 1255 l 282 1293 l 364 1293 q 434 1237 398 1270 q 507 1166 470 1204 q 578 1237 542 1204 q 650 1293 615 1270 l 732 1293 l 732 1274 "},"É":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 309 1089 q 339 1134 323 1108 q 371 1187 355 1160 q 402 1242 387 1215 q 427 1293 416 1269 l 576 1293 l 576 1278 q 543 1233 565 1260 q 496 1175 522 1205 q 442 1118 470 1146 q 391 1071 414 1089 l 309 1071 l 309 1089 "},"и":{"x_min":118,"x_max":735,"ha":853,"o":"m 234 745 l 234 291 l 226 120 l 576 745 l 735 745 l 735 0 l 618 0 l 618 439 l 625 622 l 276 0 l 118 0 l 118 745 l 234 745 "},"³":{"x_min":21,"x_max":418,"ha":460,"o":"m 400 852 q 372 764 400 800 q 298 712 345 729 q 388 660 358 697 q 418 571 418 624 q 404 496 418 530 q 362 437 390 461 q 291 399 334 413 q 190 386 249 386 q 101 394 143 386 q 21 423 59 402 l 21 514 q 110 481 64 493 q 192 469 155 469 q 290 497 260 469 q 321 575 321 525 q 283 648 321 625 q 179 671 246 671 l 111 671 l 111 745 l 179 745 q 273 771 244 745 q 303 839 303 797 q 296 876 303 860 q 277 901 289 891 q 248 915 264 911 q 213 920 232 920 q 138 907 172 920 q 69 870 105 894 l 22 935 q 62 963 41 951 q 106 985 83 976 q 155 998 129 993 q 210 1004 180 1004 q 293 992 257 1004 q 352 961 328 981 q 388 913 376 940 q 400 852 400 885 "},"[":{"x_min":111,"x_max":386,"ha":421,"o":"m 386 -220 l 111 -220 l 111 992 l 386 992 l 386 890 l 234 890 l 234 -118 l 386 -118 l 386 -220 "},"ζ":{"x_min":77,"x_max":593,"ha":632,"o":"m 118 952 l 118 1055 l 589 1055 l 589 960 q 439 811 502 880 q 334 680 377 741 q 266 567 291 619 q 226 470 240 515 q 208 387 213 425 q 204 317 204 349 q 219 220 204 256 q 263 161 235 183 q 332 128 291 140 q 424 104 373 116 q 504 78 472 94 q 556 43 536 63 q 584 -1 576 23 q 593 -54 593 -25 q 585 -114 593 -84 q 567 -172 578 -144 q 541 -225 555 -200 q 511 -272 526 -250 l 396 -272 q 426 -225 412 -250 q 451 -176 440 -201 q 469 -129 463 -152 q 476 -87 476 -107 q 471 -61 476 -73 q 450 -37 466 -48 q 403 -15 434 -25 q 321 5 373 -4 q 215 39 261 17 q 139 98 170 61 q 92 186 108 135 q 77 307 77 238 q 108 495 77 408 q 191 661 139 582 q 311 813 243 740 q 453 960 380 887 q 392 956 424 958 q 332 953 365 955 q 268 952 299 952 l 118 952 "},"∏":{"x_min":135,"x_max":895,"ha":1030,"o":"m 768 -334 l 768 880 l 261 880 l 261 -334 l 135 -334 l 135 992 l 895 992 l 895 -334 l 768 -334 "},"Έ":{"x_min":-17,"x_max":747,"ha":831,"o":"m 747 0 l 232 0 l 232 992 l 747 992 l 747 880 l 358 880 l 358 574 l 721 574 l 721 462 l 358 462 l 358 111 l 747 111 l 747 0 m -17 789 q -3 835 -10 809 q 9 889 3 861 q 21 943 16 916 q 30 993 27 970 l 165 993 l 165 978 q 149 936 160 962 q 123 880 138 909 q 90 821 107 850 q 56 771 72 792 l -17 771 l -17 789 "},"Ρ":{"x_min":135,"x_max":729,"ha":800,"o":"m 729 701 q 710 582 729 639 q 648 482 691 525 q 536 412 606 438 q 362 386 465 386 l 261 386 l 261 0 l 135 0 l 135 992 l 380 992 q 537 972 471 992 q 645 916 602 953 q 708 825 688 879 q 729 701 729 770 m 261 493 l 347 493 q 456 504 410 493 q 533 539 503 515 q 579 601 564 563 q 595 695 595 640 q 540 837 595 791 q 368 884 485 884 l 261 884 l 261 493 "},"ğ":{"x_min":25,"x_max":692.484375,"ha":720,"o":"m 692 745 l 692 668 l 559 649 q 591 588 578 625 q 604 504 604 551 q 588 409 604 453 q 539 333 572 365 q 459 283 507 301 q 348 266 412 266 q 319 266 333 266 q 294 268 304 266 q 271 253 282 261 q 251 233 260 244 q 236 208 242 222 q 230 178 230 194 q 238 148 230 159 q 260 130 246 136 q 293 122 274 124 q 333 120 312 120 l 453 120 q 560 104 516 120 q 631 61 603 88 q 670 -2 658 34 q 683 -80 683 -38 q 660 -186 683 -139 q 593 -266 638 -233 q 478 -316 547 -298 q 314 -334 408 -334 q 187 -319 241 -334 q 96 -278 132 -305 q 42 -213 60 -251 q 25 -128 25 -175 q 38 -57 25 -87 q 73 -4 51 -26 q 125 32 96 17 q 187 53 155 46 q 140 94 158 66 q 122 159 122 122 q 143 231 122 201 q 212 291 165 262 q 158 324 182 303 q 118 373 134 346 q 92 433 101 401 q 83 500 83 466 q 99 608 83 561 q 150 689 116 656 q 233 740 183 722 q 348 758 282 758 q 400 754 373 758 q 445 745 427 750 l 692 745 m 141 -126 q 150 -173 141 -151 q 179 -211 159 -195 q 232 -235 199 -226 q 314 -245 265 -245 q 503 -205 440 -245 q 566 -92 566 -166 q 558 -41 566 -61 q 531 -10 550 -21 q 482 4 512 0 q 407 8 451 8 l 287 8 q 238 3 263 8 q 190 -17 212 -2 q 155 -58 169 -32 q 141 -126 141 -84 m 206 504 q 242 388 206 426 q 344 350 278 350 q 446 388 411 350 q 480 506 480 426 q 445 629 480 590 q 343 669 410 669 q 241 628 277 669 q 206 504 206 587 m 551 1030 q 533 954 548 988 q 492 894 518 920 q 429 855 466 869 q 344 842 392 842 q 257 855 294 842 q 196 893 220 868 q 158 952 171 918 q 143 1030 145 987 l 217 1030 q 229 983 220 1000 q 255 957 239 965 q 294 946 271 948 q 347 943 317 943 q 393 946 371 943 q 433 959 415 949 q 462 985 450 968 q 476 1030 473 1002 l 551 1030 "},"ª":{"x_min":46,"x_max":392,"ha":460,"o":"m 328 541 l 308 597 q 283 570 296 582 q 254 549 270 558 q 219 536 238 540 q 177 532 201 532 q 124 540 148 532 q 82 566 100 549 q 55 610 65 584 q 46 671 46 636 q 93 777 46 740 q 236 817 140 813 l 303 820 l 303 841 q 282 909 303 890 q 224 929 262 929 q 162 919 192 929 q 104 894 132 909 l 72 961 q 146 991 106 979 q 226 1003 185 1003 q 351 967 311 1003 q 392 848 392 931 l 392 541 l 328 541 m 253 743 q 196 736 219 741 q 160 720 174 730 q 140 698 146 711 q 134 666 134 684 q 151 620 134 634 q 196 605 168 605 q 238 612 219 605 q 272 632 257 619 q 294 667 286 646 q 303 715 303 687 l 303 746 l 253 743 "},"ї":{"x_min":-13,"x_max":372,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m -13 945 q 5 998 -13 982 q 52 1015 24 1015 q 98 998 78 1015 q 117 945 117 981 q 98 892 117 909 q 52 876 78 876 q 5 892 24 876 q -13 945 -13 909 m 241 945 q 260 998 241 982 q 306 1015 279 1015 q 331 1010 319 1015 q 352 998 343 1006 q 366 977 361 989 q 372 945 372 964 q 352 892 372 909 q 306 876 332 876 q 260 892 279 876 q 241 945 241 909 "},"T":{"x_min":14,"x_max":706,"ha":721,"o":"m 423 0 l 297 0 l 297 880 l 14 880 l 14 992 l 706 992 l 706 880 l 423 880 l 423 0 "},"š":{"x_min":61.15625,"x_max":564,"ha":627,"o":"m 564 203 q 544 108 564 149 q 487 40 524 68 q 398 0 450 13 q 281 -14 346 -14 q 154 -2 207 -14 q 61 33 101 9 l 61 146 q 107 125 82 135 q 161 106 133 114 q 219 93 189 98 q 279 88 249 88 q 353 95 323 88 q 403 116 384 103 q 431 150 423 130 q 440 194 440 170 q 433 232 440 215 q 409 265 427 249 q 360 299 391 282 q 280 337 329 316 q 193 378 232 358 q 127 424 154 399 q 86 482 100 449 q 72 560 72 515 q 90 645 72 608 q 143 707 109 682 q 224 745 177 732 q 330 758 272 758 q 451 743 396 758 q 554 706 505 729 l 512 606 q 422 641 468 626 q 329 655 376 655 q 228 632 261 655 q 195 568 195 610 q 203 526 195 544 q 229 493 210 509 q 279 461 248 477 q 358 426 311 445 q 444 385 406 405 q 509 339 482 365 q 549 281 535 314 q 564 203 564 249 m 554 1045 q 513 1000 537 1026 q 467 947 490 974 q 424 892 444 919 q 394 842 404 865 l 263 842 q 233 892 253 865 q 190 947 213 919 q 144 1000 167 974 q 104 1045 121 1026 l 104 1064 l 186 1064 q 256 1008 220 1041 q 329 937 292 975 q 400 1008 364 975 q 472 1064 437 1041 l 554 1064 l 554 1045 "},"є":{"x_min":77,"x_max":596,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 264 598 314 650 q 205 434 215 547 l 528 434 l 528 331 l 204 331 q 260 149 210 205 q 402 93 309 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 "},"Þ":{"x_min":135,"x_max":729,"ha":800,"o":"m 729 530 q 710 411 729 468 q 648 311 691 354 q 536 241 606 267 q 362 215 465 215 l 261 215 l 261 0 l 135 0 l 135 992 l 261 992 l 261 821 l 380 821 q 537 801 471 821 q 645 745 602 782 q 708 654 688 708 q 729 530 729 599 m 261 322 l 347 322 q 456 333 410 322 q 533 368 503 344 q 579 430 564 392 q 595 524 595 469 q 540 667 595 621 q 368 713 485 713 l 261 713 l 261 322 "},"j":{"x_min":-46,"x_max":252.96875,"ha":359,"o":"m 44 -334 q -9 -329 12 -334 q -46 -317 -30 -324 l -46 -217 q -10 -227 -28 -224 q 31 -231 8 -231 q 65 -226 50 -231 q 93 -208 81 -221 q 111 -172 105 -194 q 118 -116 118 -150 l 118 745 l 241 745 l 241 -107 q 229 -201 241 -159 q 193 -272 218 -243 q 132 -318 169 -302 q 44 -334 95 -334 m 108 945 q 129 1004 108 986 q 180 1023 149 1023 q 208 1018 195 1023 q 231 1004 221 1014 q 247 980 241 995 q 252 945 252 966 q 231 887 252 906 q 180 868 210 868 q 129 886 149 868 q 108 945 108 905 "},"Σ":{"x_min":53,"x_max":706,"ha":739,"o":"m 53 0 l 53 103 l 333 519 l 61 892 l 61 992 l 666 992 l 666 880 l 200 880 l 466 520 l 186 111 l 706 111 l 706 0 l 53 0 "},"1":{"x_min":121,"x_max":482.375,"ha":765,"o":"m 482 0 l 363 0 l 363 619 q 363 682 363 648 q 364 748 363 715 q 366 811 365 781 q 368 864 367 841 q 348 843 356 852 q 330 826 339 834 q 310 809 320 818 q 286 788 300 800 l 186 706 l 121 789 l 380 992 l 482 992 l 482 0 "},"ϒ":{"x_min":-0.25,"x_max":742,"ha":750,"o":"m 366 496 q 403 603 383 546 q 445 714 424 660 q 487 815 467 769 q 523 891 507 861 q 554 939 538 918 q 588 973 570 960 q 628 993 606 986 q 677 1000 649 1000 q 715 996 701 1000 q 742 988 730 993 l 742 890 q 722 893 733 892 q 702 895 711 895 q 685 893 695 895 q 665 883 676 890 q 642 860 654 875 q 617 823 630 846 q 595 778 609 806 q 565 711 582 749 q 529 631 548 674 q 493 542 511 587 q 457 452 474 497 q 428 367 441 407 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 366 496 "},"ℓ":{"x_min":81,"x_max":605,"ha":695,"o":"m 426 82 q 466 90 447 82 q 500 114 485 97 q 525 158 515 130 q 537 225 535 185 l 605 225 q 589 124 602 168 q 552 49 576 79 q 493 2 528 18 q 410 -14 457 -14 q 334 -1 370 -14 q 271 39 298 11 q 227 114 243 68 q 211 228 211 161 l 211 385 q 147 364 179 374 q 81 347 114 355 l 81 422 q 148 442 116 431 q 211 462 180 452 l 211 801 q 220 878 211 841 q 251 943 230 915 q 308 989 273 972 q 395 1006 344 1006 q 461 991 431 1006 q 511 950 491 977 q 543 886 532 924 q 555 802 555 848 q 537 679 555 735 q 489 577 519 622 q 418 496 459 532 q 330 436 377 461 l 330 232 q 335 172 330 199 q 353 125 341 145 q 383 94 365 105 q 426 82 401 82 m 461 795 q 396 925 461 925 q 363 916 376 925 q 343 889 350 906 q 333 848 336 872 q 330 795 330 824 l 330 516 q 389 566 364 539 q 430 626 413 593 q 453 702 446 660 q 461 795 461 743 "},"ĉ":{"x_min":77,"x_max":618,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 253 581 302 650 q 204 369 204 513 q 253 160 204 226 q 402 93 302 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 m 618 842 l 536 842 q 464 897 501 864 q 393 967 428 930 q 320 897 356 930 q 250 842 284 864 l 168 842 l 168 860 q 208 905 185 879 q 254 958 231 931 q 297 1013 277 986 q 327 1064 317 1040 l 458 1064 q 488 1013 468 1040 q 531 958 508 986 q 577 905 554 931 q 618 860 601 879 l 618 842 "},"ī":{"x_min":-14,"x_max":376,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m -14 943 l 376 943 l 376 842 l -14 842 l -14 943 "},"О":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 "},"ξ":{"x_min":77,"x_max":593,"ha":632,"o":"m 543 601 l 543 512 l 433 512 q 336 495 379 512 q 264 449 293 478 q 219 382 234 420 q 204 299 204 343 q 219 213 204 246 q 263 160 235 181 q 332 129 291 140 q 424 106 373 117 q 504 80 472 95 q 556 44 536 64 q 584 0 576 24 q 593 -53 593 -24 q 585 -113 593 -83 q 566 -171 578 -143 q 540 -225 555 -199 q 510 -272 525 -250 l 394 -272 q 425 -225 410 -250 q 451 -176 439 -201 q 469 -129 462 -152 q 476 -86 476 -106 q 471 -60 476 -73 q 450 -36 466 -47 q 403 -14 434 -24 q 321 6 373 -3 q 139 97 201 29 q 77 288 77 165 q 92 383 77 340 q 135 459 108 426 q 195 515 161 493 q 267 550 230 538 l 267 558 q 160 622 199 577 q 122 747 122 667 q 137 830 122 796 q 179 889 152 865 q 242 931 206 914 q 321 960 278 947 q 271 956 297 958 q 220 953 249 955 q 160 952 191 952 l 117 952 l 117 1055 l 553 1055 l 553 960 l 515 960 q 415 947 465 960 q 326 908 366 934 q 262 841 287 881 q 238 748 238 801 q 249 685 238 712 q 284 638 260 657 q 346 610 308 620 q 440 601 385 601 l 543 601 "},"Ď":{"x_min":135,"x_max":865,"ha":950,"o":"m 865 505 q 832 285 865 379 q 738 127 799 190 q 586 31 676 63 q 383 0 496 0 l 135 0 l 135 992 l 410 992 q 598 960 514 992 q 741 868 682 929 q 832 715 800 806 q 865 505 865 624 m 731 501 q 709 672 731 600 q 643 791 686 744 q 538 861 601 838 q 397 884 476 884 l 261 884 l 261 107 l 370 107 q 640 207 549 107 q 731 501 731 306 m 676 1274 q 635 1229 659 1255 q 589 1176 612 1203 q 546 1121 566 1148 q 516 1071 526 1094 l 385 1071 q 355 1121 375 1094 q 312 1176 335 1148 q 266 1229 289 1203 q 226 1274 243 1255 l 226 1293 l 308 1293 q 378 1237 342 1270 q 451 1166 414 1204 q 522 1237 486 1204 q 594 1293 559 1270 l 676 1293 l 676 1274 "},"&":{"x_min":74,"x_max":953,"ha":975,"o":"m 289 789 q 294 744 289 766 q 311 700 300 722 q 340 655 322 678 q 381 608 357 633 q 448 652 420 631 q 494 695 476 673 q 522 740 513 717 q 531 792 531 764 q 523 837 531 816 q 499 872 515 857 q 462 896 483 887 q 412 904 440 904 q 322 874 355 904 q 289 789 289 844 m 377 93 q 449 101 416 93 q 511 123 483 109 q 565 155 540 137 q 611 195 589 174 l 349 471 q 285 427 313 449 q 239 381 258 406 q 211 328 220 357 q 201 261 201 299 q 213 193 201 224 q 247 140 225 162 q 302 106 270 118 q 377 93 335 93 m 74 257 q 87 352 74 310 q 127 427 101 393 q 191 490 153 461 q 277 548 228 519 q 235 598 256 572 q 200 654 215 624 q 175 717 184 683 q 166 789 166 751 q 182 881 166 840 q 231 949 199 921 q 310 992 263 977 q 416 1007 356 1007 q 516 992 472 1007 q 591 949 560 977 q 638 881 622 921 q 655 790 655 840 q 638 709 655 746 q 593 641 621 672 q 529 582 565 609 q 452 531 492 556 l 690 279 q 723 319 708 299 q 749 362 738 339 q 770 411 761 385 q 786 470 779 438 l 910 470 q 886 387 899 425 q 854 317 872 350 q 814 255 836 283 q 766 198 792 226 l 953 0 l 800 0 l 686 116 q 620 61 653 85 q 551 21 588 37 q 472 -4 514 4 q 377 -14 430 -14 q 250 3 306 -14 q 154 56 193 21 q 94 142 115 91 q 74 257 74 192 "},"G":{"x_min":85,"x_max":858,"ha":958,"o":"m 530 524 l 858 524 l 858 36 q 782 15 820 24 q 704 0 744 5 q 620 -10 664 -7 q 526 -14 576 -14 q 337 21 419 -14 q 199 123 255 57 q 114 284 143 189 q 85 497 85 378 q 117 708 85 613 q 211 868 149 802 q 363 970 272 934 q 569 1006 453 1006 q 713 991 644 1006 q 842 947 782 976 l 793 837 q 741 859 769 849 q 683 877 713 869 q 621 890 653 885 q 559 894 590 894 q 412 867 476 894 q 306 788 349 839 q 240 662 263 736 q 218 496 218 588 q 237 334 218 407 q 296 208 255 261 q 401 126 336 155 q 556 97 465 97 q 610 98 585 97 q 656 103 635 100 q 695 109 677 106 q 731 116 714 113 l 731 412 l 530 412 l 530 524 "},"ΰ":{"x_min":111,"x_max":736,"ha":819,"o":"m 409 -14 q 264 13 322 -14 q 172 87 206 40 q 124 199 138 135 q 111 337 111 263 l 111 745 l 234 745 l 234 345 q 245 239 234 286 q 278 158 256 192 q 335 106 300 125 q 417 88 370 88 q 564 167 516 88 q 612 412 612 245 q 609 503 612 461 q 601 585 606 545 q 587 664 595 625 q 569 745 580 703 l 693 745 q 711 664 703 703 q 725 585 719 626 q 733 501 730 545 q 736 406 736 457 q 653 88 736 190 q 409 -14 570 -14 m 357 959 q 372 1005 364 980 q 389 1057 381 1030 q 404 1112 397 1084 q 417 1164 412 1139 l 558 1164 l 558 1150 q 529 1102 545 1128 q 494 1049 513 1076 q 454 994 475 1022 q 412 942 434 967 l 357 942 l 357 959 m 198 945 q 212 998 198 982 q 247 1015 226 1015 q 265 1010 256 1015 q 281 998 274 1006 q 291 977 287 989 q 295 945 295 964 q 280 892 295 909 q 247 876 266 876 q 212 892 226 876 q 198 945 198 909 m 527 945 q 541 998 527 982 q 576 1015 555 1015 q 594 1010 585 1015 q 610 998 603 1006 q 620 977 616 989 q 625 945 625 964 q 610 892 625 909 q 576 876 595 876 q 541 892 555 876 q 527 945 527 909 "},"`":{"x_min":267,"x_max":534,"ha":802,"o":"m 534 842 l 452 842 q 400 889 428 860 q 346 946 372 917 q 299 1004 320 976 q 267 1049 277 1031 l 267 1064 l 415 1064 q 441 1013 426 1040 q 471 958 455 986 q 503 905 487 931 q 534 860 519 879 l 534 842 "},"ŏ":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 605 1030 q 587 954 602 988 q 546 894 572 920 q 483 855 520 869 q 398 842 446 842 q 311 855 348 842 q 250 893 274 868 q 212 952 225 918 q 197 1030 199 987 l 271 1030 q 283 983 274 1000 q 309 957 293 965 q 348 946 325 948 q 401 943 371 943 q 447 946 425 943 q 487 959 469 949 q 516 985 504 968 q 530 1030 527 1002 l 605 1030 "},"ý":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 6 745 l 134 745 l 280 329 q 300 272 290 301 q 318 212 310 242 q 333 154 327 182 q 341 103 339 126 l 346 103 q 356 149 349 120 q 373 211 364 178 q 392 276 382 244 q 409 330 402 308 l 544 745 l 672 745 l 377 -96 q 336 -195 358 -152 q 285 -270 314 -239 q 217 -317 256 -300 q 123 -334 177 -334 q 62 -330 88 -334 q 18 -322 36 -326 l 18 -223 q 54 -229 32 -226 q 99 -231 75 -231 q 156 -223 132 -231 q 197 -201 179 -216 q 227 -164 215 -186 q 250 -115 240 -142 l 289 -6 l 6 745 m 276 860 q 306 905 290 879 q 338 958 322 931 q 369 1013 354 986 q 394 1064 383 1040 l 543 1064 l 543 1049 q 510 1004 532 1031 q 463 946 489 976 q 409 889 437 917 q 358 842 381 860 l 276 842 l 276 860 "},"º":{"x_min":45,"x_max":441,"ha":486,"o":"m 441 768 q 427 668 441 712 q 387 594 413 624 q 324 547 361 563 q 241 532 287 532 q 162 547 198 532 q 100 594 126 563 q 59 668 74 624 q 45 768 45 712 q 58 868 45 824 q 98 942 72 912 q 161 987 124 971 q 244 1003 197 1003 q 322 987 285 1003 q 384 942 358 971 q 426 868 411 912 q 441 768 441 824 m 133 769 q 159 647 133 688 q 243 605 184 605 q 326 647 301 605 q 352 769 352 688 q 326 889 352 850 q 243 929 301 929 q 159 889 184 929 q 133 769 133 850 "},"∞":{"x_min":81,"x_max":901,"ha":982,"o":"m 901 486 q 886 405 901 443 q 845 336 871 366 q 782 289 819 307 q 700 272 745 272 q 585 307 637 272 q 488 421 532 343 q 445 362 468 388 q 395 316 421 335 q 340 287 368 297 q 283 277 312 277 q 202 291 239 277 q 138 334 164 306 q 96 402 111 362 q 81 490 81 441 q 95 573 81 534 q 136 641 110 612 q 200 687 162 670 q 283 704 238 704 q 394 667 340 704 q 489 555 447 631 q 532 614 509 588 q 582 659 555 640 q 638 689 609 678 q 700 699 668 699 q 782 684 745 699 q 845 641 819 669 q 886 574 871 613 q 901 486 901 534 m 296 369 q 372 398 337 369 q 441 490 407 426 q 374 581 409 552 q 294 611 339 611 q 247 601 268 611 q 212 575 227 592 q 190 536 198 558 q 182 489 182 514 q 189 443 182 465 q 210 405 196 422 q 246 379 225 389 q 296 369 267 369 m 690 607 q 612 578 648 607 q 538 486 575 550 q 609 395 573 425 q 692 365 646 365 q 740 374 718 365 q 777 400 762 384 q 800 439 792 417 q 808 487 808 462 q 800 534 808 512 q 776 572 791 556 q 739 597 760 588 q 690 607 717 607 "},"ź":{"x_min":56,"x_max":556.21875,"ha":612,"o":"m 556 0 l 56 0 l 56 80 l 418 656 l 78 656 l 78 745 l 544 745 l 544 650 l 189 88 l 556 88 l 556 0 m 238 860 q 268 905 252 879 q 300 958 284 931 q 331 1013 316 986 q 356 1064 345 1040 l 505 1064 l 505 1049 q 472 1004 494 1031 q 425 946 451 976 q 371 889 399 917 q 320 842 343 860 l 238 842 l 238 860 "},"я":{"x_min":22.75,"x_max":619,"ha":737,"o":"m 157 0 l 22 0 l 220 315 q 161 339 190 323 q 111 381 133 355 q 75 443 89 407 q 62 527 62 479 q 81 621 62 580 q 133 689 100 662 q 214 730 167 716 q 317 745 261 745 l 619 745 l 619 0 l 495 0 l 495 295 l 330 295 l 157 0 m 178 525 q 191 468 178 492 q 226 428 203 444 q 278 405 248 413 q 346 398 309 398 l 495 398 l 495 642 l 322 642 q 214 610 249 642 q 178 525 178 577 "},"Ё":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 201 1174 q 219 1227 201 1211 q 266 1244 238 1244 q 312 1227 292 1244 q 331 1174 331 1210 q 312 1121 331 1138 q 266 1105 292 1105 q 219 1121 238 1105 q 201 1174 201 1138 m 455 1174 q 474 1227 455 1211 q 520 1244 493 1244 q 545 1239 533 1244 q 566 1227 557 1235 q 580 1206 575 1218 q 586 1174 586 1193 q 566 1121 586 1138 q 520 1105 546 1105 q 474 1121 493 1105 q 455 1174 455 1138 "},"ń":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 0 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 0 l 583 0 m 342 860 q 372 905 356 879 q 404 958 388 931 q 435 1013 420 986 q 460 1064 449 1040 l 609 1064 l 609 1049 q 576 1004 598 1031 q 529 946 555 976 q 475 889 503 917 q 424 842 447 860 l 342 842 l 342 860 "}," ":{"x_min":0,"x_max":0,"ha":347},"Г":{"x_min":135,"x_max":649,"ha":682,"o":"m 649 992 l 649 880 l 261 880 l 261 0 l 135 0 l 135 992 l 649 992 "},"Ь":{"x_min":135,"x_max":729,"ha":800,"o":"m 729 290 q 708 170 729 224 q 645 79 688 117 q 537 20 602 41 q 380 0 471 0 l 135 0 l 135 992 l 261 992 l 261 574 l 362 574 q 536 551 465 574 q 648 490 606 529 q 710 400 691 452 q 729 290 729 349 m 261 107 l 368 107 q 540 152 485 107 q 595 290 595 197 q 579 370 595 337 q 533 424 564 403 q 456 453 503 444 q 347 462 410 462 l 261 462 l 261 107 "},"¤":{"x_min":83.640625,"x_max":680.03125,"ha":765,"o":"m 126 490 q 137 566 126 530 q 170 634 149 602 l 83 721 l 149 788 l 235 700 q 304 734 267 722 q 381 747 341 747 q 458 734 422 747 q 526 700 495 722 l 613 788 l 680 723 l 592 635 q 626 567 613 604 q 639 490 639 530 q 627 412 639 449 q 592 344 615 375 l 678 258 l 613 193 l 526 279 q 458 246 495 258 q 381 235 422 235 q 303 247 341 235 q 235 281 266 259 l 149 195 l 85 259 l 170 345 q 137 412 149 376 q 126 490 126 449 m 227 489 q 239 426 227 455 q 273 375 252 397 q 323 340 295 353 q 385 327 352 327 q 448 340 419 327 q 499 375 478 353 q 534 426 521 397 q 546 489 546 455 q 534 554 546 524 q 499 606 521 584 q 448 641 478 628 q 385 654 419 654 q 323 641 352 654 q 273 606 295 628 q 239 554 252 584 q 227 489 227 524 "},"Ĝ":{"x_min":85,"x_max":858,"ha":958,"o":"m 530 524 l 858 524 l 858 36 q 782 15 820 24 q 704 0 744 5 q 620 -10 664 -7 q 526 -14 576 -14 q 337 21 419 -14 q 199 123 255 57 q 114 284 143 189 q 85 497 85 378 q 117 708 85 613 q 211 868 149 802 q 363 970 272 934 q 569 1006 453 1006 q 713 991 644 1006 q 842 947 782 976 l 793 837 q 741 859 769 849 q 683 877 713 869 q 621 890 653 885 q 559 894 590 894 q 412 867 476 894 q 306 788 349 839 q 240 662 263 736 q 218 496 218 588 q 237 334 218 407 q 296 208 255 261 q 401 126 336 155 q 556 97 465 97 q 610 98 585 97 q 656 103 635 100 q 695 109 677 106 q 731 116 714 113 l 731 412 l 530 412 l 530 524 m 771 1071 l 689 1071 q 617 1126 654 1093 q 546 1196 581 1159 q 473 1126 509 1159 q 403 1071 437 1093 l 321 1071 l 321 1089 q 361 1134 338 1108 q 407 1187 384 1160 q 450 1242 430 1215 q 480 1293 470 1269 l 611 1293 q 641 1242 621 1269 q 684 1187 661 1215 q 730 1134 707 1160 q 771 1089 754 1108 l 771 1071 "},"p":{"x_min":118,"x_max":737,"ha":814,"o":"m 454 -14 q 381 -5 414 -14 q 323 18 349 3 q 277 52 297 32 q 241 93 257 72 l 233 93 q 237 49 235 70 q 240 13 238 32 q 241 -16 241 -5 l 241 -334 l 118 -334 l 118 745 l 218 745 l 236 644 l 241 644 q 276 688 257 667 q 322 724 296 709 q 381 748 348 739 q 454 758 413 758 q 570 733 518 758 q 659 660 622 709 q 716 540 696 612 q 737 373 737 468 q 716 205 737 277 q 659 84 696 133 q 570 10 622 35 q 454 -14 518 -14 m 430 655 q 343 639 379 655 q 285 592 307 624 q 253 513 263 560 q 241 401 242 465 l 241 373 q 250 251 241 304 q 281 162 259 198 q 340 107 303 125 q 431 88 377 88 q 566 162 523 88 q 609 374 609 236 q 566 585 609 515 q 430 655 523 655 "},"Ю":{"x_min":135,"x_max":1323,"ha":1409,"o":"m 1323 496 q 1296 287 1323 382 q 1216 126 1269 193 q 1086 22 1164 59 q 906 -14 1008 -14 q 728 19 804 -14 q 600 116 651 53 q 521 266 548 178 q 490 462 494 354 l 261 462 l 261 0 l 135 0 l 135 992 l 261 992 l 261 574 l 493 574 q 529 752 500 672 q 609 889 558 832 q 735 976 661 946 q 908 1007 809 1007 q 1087 970 1009 1007 q 1217 867 1164 934 q 1296 706 1269 800 q 1323 496 1323 612 m 626 497 q 643 330 626 404 q 694 204 659 255 q 782 124 729 152 q 908 97 835 97 q 1035 124 981 97 q 1122 204 1088 152 q 1173 330 1156 255 q 1189 497 1189 404 q 1173 664 1189 590 q 1122 789 1156 738 q 1035 868 1088 840 q 909 895 982 895 q 782 868 836 895 q 694 789 729 840 q 643 664 659 738 q 626 497 626 590 "},"ο":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 "},"S":{"x_min":70.109375,"x_max":657,"ha":721,"o":"m 657 264 q 633 147 657 199 q 566 59 610 95 q 460 4 523 23 q 320 -14 398 -14 q 179 -2 245 -14 q 70 32 114 9 l 70 153 q 122 131 93 142 q 184 112 151 120 q 251 99 216 104 q 319 93 285 93 q 479 134 427 93 q 530 252 530 176 q 521 316 530 289 q 486 366 511 343 q 420 410 461 389 q 316 456 379 431 q 212 508 256 480 q 139 572 168 537 q 96 652 110 607 q 83 754 83 697 q 104 860 83 813 q 165 939 126 907 q 259 989 205 972 q 380 1006 314 1006 q 525 990 460 1006 q 640 951 589 975 l 595 845 q 495 880 551 865 q 381 894 440 894 q 254 856 299 894 q 209 752 209 818 q 219 686 209 714 q 252 635 229 657 q 315 592 276 612 q 410 549 353 572 q 517 499 471 525 q 594 441 563 473 q 641 366 625 408 q 657 264 657 323 "},"/":{"x_min":13.75,"x_max":504.015625,"ha":518,"o":"m 504 992 l 135 0 l 13 0 l 383 992 l 504 992 "},"Ŧ":{"x_min":14,"x_max":706,"ha":721,"o":"m 297 556 l 297 880 l 14 880 l 14 992 l 706 992 l 706 880 l 423 880 l 423 556 l 623 556 l 623 448 l 423 448 l 423 0 l 297 0 l 297 448 l 95 448 l 95 556 l 297 556 "},"ђ":{"x_min":12.1875,"x_max":707,"ha":818,"o":"m 510 -334 q 456 -329 477 -334 q 419 -317 435 -324 l 419 -217 q 455 -227 437 -224 q 497 -231 473 -231 q 531 -226 515 -231 q 558 -208 546 -221 q 577 -172 570 -194 q 583 -116 583 -150 l 583 451 q 547 583 583 539 q 436 627 512 627 q 343 609 381 627 q 283 557 306 592 q 251 473 261 523 q 241 357 241 422 l 241 0 l 118 0 l 118 843 l 12 843 l 12 932 l 118 932 l 118 1055 l 241 1055 l 241 932 l 498 932 l 498 843 l 241 843 l 241 715 l 236 616 l 242 616 q 283 666 259 645 q 334 702 306 687 q 393 723 362 716 q 457 730 424 730 q 644 665 581 730 q 707 458 707 600 l 707 -107 q 695 -201 707 -159 q 659 -272 683 -243 q 598 -318 635 -302 q 510 -334 561 -334 "},"y":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 6 745 l 134 745 l 280 329 q 300 272 290 301 q 318 212 310 242 q 333 154 327 182 q 341 103 339 126 l 346 103 q 356 149 349 120 q 373 211 364 178 q 392 276 382 244 q 409 330 402 308 l 544 745 l 672 745 l 377 -96 q 336 -195 358 -152 q 285 -270 314 -239 q 217 -317 256 -300 q 123 -334 177 -334 q 62 -330 88 -334 q 18 -322 36 -326 l 18 -223 q 54 -229 32 -226 q 99 -231 75 -231 q 156 -223 132 -231 q 197 -201 179 -216 q 227 -164 215 -186 q 250 -115 240 -142 l 289 -6 l 6 745 "},"Π":{"x_min":135,"x_max":826,"ha":960,"o":"m 826 0 l 699 0 l 699 880 l 261 880 l 261 0 l 135 0 l 135 992 l 826 992 l 826 0 "},"‗":{"x_min":-3,"x_max":574,"ha":571,"o":"m 574 -314 l -3 -314 l -3 -219 l 574 -219 l 574 -314 m 574 -125 l -3 -125 l -3 -31 l 574 -31 l 574 -125 "},"–":{"x_min":56,"x_max":639,"ha":695,"o":"m 56 315 l 56 429 l 639 429 l 639 315 l 56 315 "},"ë":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 183 945 q 201 998 183 982 q 248 1015 220 1015 q 294 998 274 1015 q 313 945 313 981 q 294 892 313 909 q 248 876 274 876 q 201 892 220 876 q 183 945 183 909 m 437 945 q 456 998 437 982 q 502 1015 475 1015 q 527 1010 515 1015 q 548 998 539 1006 q 562 977 557 989 q 568 945 568 964 q 548 892 568 909 q 502 876 528 876 q 456 892 475 876 q 437 945 437 909 "},"б":{"x_min":79,"x_max":716,"ha":791,"o":"m 79 446 q 95 664 79 569 q 147 828 112 759 q 237 940 182 897 q 369 999 292 982 q 535 1034 453 1018 q 686 1065 617 1051 l 709 957 q 633 944 675 951 q 549 928 592 936 q 467 912 507 920 q 398 897 428 904 q 322 865 356 887 q 264 804 288 843 q 225 710 239 766 q 209 577 211 654 l 218 577 q 251 617 230 597 q 300 654 272 638 q 365 682 329 671 q 445 693 401 693 q 562 668 512 693 q 647 599 613 643 q 699 493 682 554 q 716 359 716 432 q 692 196 716 266 q 627 79 669 126 q 526 9 585 32 q 396 -14 467 -14 q 265 16 324 -14 q 165 105 207 46 q 101 249 123 163 q 79 446 79 335 m 406 88 q 481 101 447 88 q 538 144 514 114 q 575 223 562 174 q 588 343 588 271 q 579 445 588 400 q 550 523 570 491 q 500 573 531 555 q 425 590 469 590 q 347 574 383 590 q 282 534 311 557 q 234 486 254 511 q 206 444 215 462 q 215 312 206 376 q 245 198 223 248 q 306 118 268 148 q 406 88 345 88 "},"ƒ":{"x_min":138,"x_max":679,"ha":765,"o":"m 444 552 l 444 -89 q 429 -207 444 -160 q 385 -282 413 -254 q 314 -322 356 -310 q 220 -334 272 -334 q 177 -330 198 -334 q 138 -323 156 -327 l 138 -219 q 174 -228 155 -224 q 215 -231 194 -231 q 262 -225 242 -231 q 295 -202 282 -218 q 314 -159 308 -187 q 321 -88 321 -131 l 321 552 l 189 552 l 189 610 l 321 664 l 321 757 q 336 877 321 829 q 380 953 351 925 q 451 994 409 982 q 546 1006 493 1006 q 619 998 586 1006 q 679 980 653 990 l 647 884 q 601 897 626 892 q 550 903 577 903 q 503 897 523 903 q 470 874 483 890 q 450 830 457 858 q 444 758 444 802 l 444 660 l 611 660 l 611 552 l 444 552 "},"у":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 6 745 l 134 745 l 280 329 q 300 272 290 301 q 318 212 310 242 q 333 154 327 182 q 341 103 339 126 l 346 103 q 356 149 349 120 q 373 211 364 178 q 392 276 382 244 q 409 330 402 308 l 544 745 l 672 745 l 377 -96 q 336 -195 358 -152 q 285 -270 314 -239 q 217 -317 256 -300 q 123 -334 177 -334 q 62 -330 88 -334 q 18 -322 36 -326 l 18 -223 q 54 -229 32 -226 q 99 -231 75 -231 q 156 -223 132 -231 q 197 -201 179 -216 q 227 -164 215 -186 q 250 -115 240 -142 l 289 -6 l 6 745 "},"J":{"x_min":-125,"x_max":251.15625,"ha":376,"o":"m -19 -264 q -80 -259 -54 -264 q -125 -247 -106 -255 l -125 -139 q -75 -149 -101 -145 q -18 -152 -48 -152 q 32 -146 6 -152 q 78 -122 57 -139 q 112 -76 99 -105 q 125 0 125 -46 l 125 992 l 251 992 l 251 13 q 231 -109 251 -57 q 175 -196 211 -162 q 90 -247 140 -230 q -19 -264 40 -264 "},"ŷ":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 6 745 l 134 745 l 280 329 q 300 272 290 301 q 318 212 310 242 q 333 154 327 182 q 341 103 339 126 l 346 103 q 356 149 349 120 q 373 211 364 178 q 392 276 382 244 q 409 330 402 308 l 544 745 l 672 745 l 377 -96 q 336 -195 358 -152 q 285 -270 314 -239 q 217 -317 256 -300 q 123 -334 177 -334 q 62 -330 88 -334 q 18 -322 36 -326 l 18 -223 q 54 -229 32 -226 q 99 -231 75 -231 q 156 -223 132 -231 q 197 -201 179 -216 q 227 -164 215 -186 q 250 -115 240 -142 l 289 -6 l 6 745 m 566 842 l 484 842 q 412 897 449 864 q 341 967 376 930 q 268 897 304 930 q 198 842 232 864 l 116 842 l 116 860 q 156 905 133 879 q 202 958 179 931 q 245 1013 225 986 q 275 1064 265 1040 l 406 1064 q 436 1013 416 1040 q 479 958 456 986 q 525 905 502 931 q 566 860 549 879 l 566 842 "},"ŕ":{"x_min":118,"x_max":526,"ha":554,"o":"m 439 758 q 483 756 459 758 q 526 751 508 754 l 509 637 q 470 643 490 640 q 433 645 450 645 q 355 628 390 645 q 294 578 320 610 q 255 501 269 546 q 241 401 241 456 l 241 0 l 118 0 l 118 745 l 218 745 l 233 608 l 238 608 q 274 664 255 637 q 318 712 294 691 q 372 745 342 732 q 439 758 402 758 m 232 860 q 262 905 246 879 q 294 958 278 931 q 325 1013 310 986 q 350 1064 339 1040 l 499 1064 l 499 1049 q 466 1004 488 1031 q 419 946 445 976 q 365 889 393 917 q 314 842 337 860 l 232 842 l 232 860 "},"ώ":{"x_min":77,"x_max":970,"ha":1046,"o":"m 332 -14 q 223 13 271 -14 q 143 91 176 41 q 93 209 110 140 q 77 360 77 278 q 82 464 77 415 q 97 558 87 512 q 124 650 108 604 q 162 745 140 696 l 289 745 q 251 649 267 695 q 225 558 235 604 q 209 464 214 512 q 204 360 204 416 q 214 243 204 294 q 242 158 224 192 q 285 106 260 123 q 340 88 310 88 q 394 102 371 88 q 432 140 417 116 q 454 198 447 165 q 462 270 462 231 l 462 478 l 585 478 l 585 270 q 618 135 585 182 q 706 88 651 88 q 761 106 736 88 q 804 158 786 123 q 832 243 823 192 q 842 360 842 294 q 837 464 842 416 q 821 558 832 512 q 795 649 811 604 q 757 745 779 695 l 884 745 q 922 650 906 696 q 949 558 938 604 q 964 464 959 512 q 970 360 970 415 q 953 209 970 278 q 903 91 936 140 q 823 13 871 41 q 714 -14 775 -14 q 595 15 642 -14 q 527 106 548 45 l 520 106 q 452 15 499 45 q 332 -14 404 -14 m 474 860 q 487 906 480 880 q 500 960 494 932 q 512 1014 507 987 q 521 1064 518 1041 l 656 1064 l 656 1049 q 640 1007 651 1033 q 614 951 629 980 q 581 892 598 921 q 547 842 563 863 l 474 842 l 474 860 "},"˘":{"x_min":196,"x_max":604,"ha":802,"o":"m 604 1030 q 586 954 601 988 q 545 894 571 920 q 482 855 519 869 q 397 842 445 842 q 310 855 347 842 q 249 893 273 868 q 211 952 224 918 q 196 1030 198 987 l 270 1030 q 282 983 273 1000 q 308 957 292 965 q 347 946 324 948 q 400 943 370 943 q 446 946 424 943 q 486 959 468 949 q 515 985 503 968 q 529 1030 526 1002 l 604 1030 "},"D":{"x_min":135,"x_max":865,"ha":950,"o":"m 865 505 q 832 285 865 379 q 738 127 799 190 q 586 31 676 63 q 383 0 496 0 l 135 0 l 135 992 l 410 992 q 598 960 514 992 q 741 868 682 929 q 832 715 800 806 q 865 505 865 624 m 731 501 q 709 672 731 600 q 643 791 686 744 q 538 861 601 838 q 397 884 476 884 l 261 884 l 261 107 l 370 107 q 640 207 549 107 q 731 501 731 306 "},"ł":{"x_min":-7,"x_max":367,"ha":359,"o":"m 118 513 l 118 1055 l 241 1055 l 241 593 l 314 641 l 367 558 l 241 477 l 241 0 l 118 0 l 118 396 l 45 350 l -7 432 l 118 513 "},"ĺ":{"x_min":116,"x_max":383,"ha":359,"o":"m 241 0 l 118 0 l 118 1055 l 241 1055 l 241 0 m 116 1128 q 146 1173 130 1147 q 178 1226 162 1199 q 209 1281 194 1254 q 234 1332 223 1308 l 383 1332 l 383 1317 q 350 1272 372 1299 q 303 1214 329 1244 q 249 1157 277 1185 q 198 1110 221 1128 l 116 1110 l 116 1128 "},"ц":{"x_min":118,"x_max":815,"ha":836,"o":"m 815 -258 l 691 -258 l 691 0 l 118 0 l 118 745 l 241 745 l 241 102 l 582 102 l 582 745 l 706 745 l 706 102 l 815 102 l 815 -258 "},"Л":{"x_min":0,"x_max":794,"ha":929,"o":"m 794 0 l 667 0 l 667 880 l 432 880 q 411 721 421 804 q 389 558 400 638 q 367 406 378 478 q 344 279 355 334 q 311 154 330 209 q 263 61 291 99 q 195 4 234 24 q 99 -16 155 -16 q 46 -11 73 -16 q 0 0 20 -6 l 0 105 q 35 95 15 99 q 76 91 55 91 q 130 113 109 91 q 165 167 151 134 q 188 239 180 200 q 205 315 197 279 q 224 421 214 354 q 248 577 235 488 q 276 771 262 665 q 306 992 291 877 l 794 992 l 794 0 "},"$":{"x_min":83,"x_max":668,"ha":765,"o":"m 668 303 q 651 216 668 255 q 602 149 634 177 q 525 102 570 120 q 423 75 480 83 l 423 -81 l 330 -81 l 330 69 q 261 72 296 69 q 194 81 226 75 q 133 96 161 87 q 83 116 104 104 l 83 233 q 134 212 105 222 q 197 193 164 201 q 263 179 229 185 q 330 174 298 174 l 330 466 q 225 509 269 487 q 151 560 180 531 q 108 626 122 589 q 94 713 94 663 q 110 796 94 759 q 158 862 127 834 q 232 908 188 890 q 330 932 276 926 l 330 1054 l 423 1054 l 423 935 q 548 917 491 931 q 651 882 606 903 l 606 783 q 521 812 568 799 q 423 829 473 826 l 423 547 q 529 504 483 526 q 605 453 574 481 q 652 388 636 425 q 668 303 668 352 m 548 302 q 541 344 548 325 q 520 378 535 362 q 482 406 505 393 q 423 432 458 420 l 423 180 q 517 222 486 190 q 548 302 548 254 m 213 711 q 219 668 213 687 q 238 633 224 649 q 274 605 252 617 q 330 580 296 592 l 330 827 q 241 787 269 816 q 213 711 213 757 "},"w":{"x_min":13.75,"x_max":1022.25,"ha":1036,"o":"m 683 0 l 570 417 q 563 445 567 430 q 555 477 559 460 q 546 512 551 494 q 538 546 542 529 q 518 628 528 586 l 514 628 q 496 546 505 585 q 480 476 488 512 q 464 415 471 440 l 347 0 l 204 0 l 13 745 l 143 745 l 232 348 q 245 282 239 318 q 258 211 252 246 q 269 146 264 177 q 277 95 274 115 l 281 95 q 290 142 284 113 q 303 205 296 172 q 317 270 310 238 q 331 324 325 302 l 453 745 l 586 745 l 702 324 q 716 270 709 301 q 732 207 724 239 q 745 145 739 175 q 754 95 751 115 l 758 95 q 764 142 760 113 q 775 207 769 172 q 788 279 781 242 q 803 348 795 316 l 896 745 l 1022 745 l 829 0 l 683 0 "},"о":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 "},"Д":{"x_min":10,"x_max":876,"ha":903,"o":"m 876 -261 l 749 -261 l 749 0 l 136 0 l 136 -261 l 10 -261 l 10 111 l 86 111 q 147 223 118 170 q 203 354 177 277 q 251 512 229 431 q 290 675 273 593 q 316 837 306 757 q 329 992 326 917 l 744 992 l 744 111 l 876 111 l 876 -261 m 617 111 l 617 880 l 455 880 q 440 766 452 829 q 413 634 429 703 q 374 494 396 565 q 326 355 352 423 q 273 224 301 286 q 216 111 245 162 l 617 111 "},"Ç":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 406 867 465 894 q 305 788 347 839 q 241 662 264 736 q 218 496 218 588 q 238 326 218 400 q 298 200 258 251 q 398 123 338 150 q 538 97 458 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 m 622 -194 q 574 -297 622 -260 q 424 -334 526 -334 q 394 -331 409 -334 q 369 -327 379 -329 l 369 -254 q 395 -257 379 -256 q 422 -258 412 -258 q 497 -247 470 -258 q 524 -208 524 -235 q 515 -186 524 -195 q 491 -169 506 -176 q 454 -157 476 -162 q 409 -147 433 -152 l 470 0 l 552 0 l 513 -78 q 556 -92 536 -83 q 590 -115 575 -101 q 613 -148 605 -128 q 622 -194 622 -168 "},"Ŝ":{"x_min":70.109375,"x_max":657,"ha":721,"o":"m 657 264 q 633 147 657 199 q 566 59 610 95 q 460 4 523 23 q 320 -14 398 -14 q 179 -2 245 -14 q 70 32 114 9 l 70 153 q 122 131 93 142 q 184 112 151 120 q 251 99 216 104 q 319 93 285 93 q 479 134 427 93 q 530 252 530 176 q 521 316 530 289 q 486 366 511 343 q 420 410 461 389 q 316 456 379 431 q 212 508 256 480 q 139 572 168 537 q 96 652 110 607 q 83 754 83 697 q 104 860 83 813 q 165 939 126 907 q 259 989 205 972 q 380 1006 314 1006 q 525 990 460 1006 q 640 951 589 975 l 595 845 q 495 880 551 865 q 381 894 440 894 q 254 856 299 894 q 209 752 209 818 q 219 686 209 714 q 252 635 229 657 q 315 592 276 612 q 410 549 353 572 q 517 499 471 525 q 594 441 563 473 q 641 366 625 408 q 657 264 657 323 m 612 1071 l 530 1071 q 458 1126 495 1093 q 387 1196 422 1159 q 314 1126 350 1159 q 244 1071 278 1093 l 162 1071 l 162 1089 q 202 1134 179 1108 q 248 1187 225 1160 q 291 1242 271 1215 q 321 1293 311 1269 l 452 1293 q 482 1242 462 1269 q 525 1187 502 1215 q 571 1134 548 1160 q 612 1089 595 1108 l 612 1071 "},"C":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 406 867 465 894 q 305 788 347 839 q 241 662 264 736 q 218 496 218 588 q 238 326 218 400 q 298 200 258 251 q 398 123 338 150 q 538 97 458 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 "},"Ḁ":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 576 -229 q 564 -291 576 -264 q 531 -338 552 -319 q 482 -367 510 -357 q 420 -377 453 -377 q 358 -367 386 -377 q 310 -338 330 -357 q 279 -292 290 -319 q 269 -231 269 -265 q 279 -169 269 -196 q 310 -123 290 -142 q 358 -94 330 -104 q 420 -85 386 -85 q 481 -94 453 -85 q 531 -123 510 -104 q 564 -168 552 -142 q 576 -229 576 -195 m 501 -231 q 479 -174 501 -194 q 422 -154 456 -154 q 365 -174 387 -154 q 343 -231 343 -194 q 363 -287 343 -267 q 422 -307 383 -307 q 479 -287 456 -307 q 501 -231 501 -267 "},"Ĵ":{"x_min":-125,"x_max":414,"ha":376,"o":"m -19 -264 q -80 -259 -54 -264 q -125 -247 -106 -255 l -125 -139 q -75 -149 -101 -145 q -18 -152 -48 -152 q 32 -146 6 -152 q 78 -122 57 -139 q 112 -76 99 -105 q 125 0 125 -46 l 125 992 l 251 992 l 251 13 q 231 -109 251 -57 q 175 -196 211 -162 q 90 -247 140 -230 q -19 -264 40 -264 m 414 1071 l 332 1071 q 260 1126 297 1093 q 189 1196 224 1159 q 116 1126 152 1159 q 46 1071 80 1093 l -36 1071 l -36 1089 q 4 1134 -18 1108 q 50 1187 27 1160 q 93 1242 73 1215 q 123 1293 113 1269 l 254 1293 q 284 1242 264 1269 q 327 1187 304 1215 q 373 1134 350 1160 q 414 1089 397 1108 l 414 1071 "},"È":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 484 1071 l 402 1071 q 350 1118 378 1089 q 296 1175 322 1146 q 249 1233 270 1205 q 217 1278 227 1260 l 217 1293 l 365 1293 q 391 1242 376 1269 q 421 1187 405 1215 q 453 1134 437 1160 q 484 1089 469 1108 l 484 1071 "},"ﬁ":{"x_min":19,"x_max":709.96875,"ha":817,"o":"m 441 656 l 274 656 l 274 0 l 151 0 l 151 656 l 19 656 l 19 704 l 151 749 l 151 814 q 166 934 151 886 q 210 1010 181 982 q 280 1051 238 1039 q 375 1063 322 1063 q 449 1055 415 1063 q 509 1037 482 1047 l 477 941 q 431 954 456 949 q 379 960 406 960 q 332 954 352 960 q 300 931 313 947 q 280 887 287 915 q 274 815 274 859 l 274 745 l 441 745 l 441 656 m 698 0 l 575 0 l 575 745 l 698 745 l 698 0 m 565 945 q 586 1004 565 986 q 637 1023 606 1023 q 665 1018 652 1023 q 688 1004 678 1014 q 704 980 698 995 q 709 945 709 966 q 688 887 709 906 q 637 868 667 868 q 586 886 606 868 q 565 945 565 905 "},"X":{"x_min":-0.25,"x_max":760.25,"ha":760,"o":"m 760 0 l 617 0 l 376 430 l 127 0 l 0 0 l 307 518 l 20 992 l 155 992 l 380 612 l 608 992 l 737 992 l 450 522 l 760 0 "},"ô":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 622 842 l 540 842 q 468 897 505 864 q 397 967 432 930 q 324 897 360 930 q 254 842 288 864 l 172 842 l 172 860 q 212 905 189 879 q 258 958 235 931 q 301 1013 281 986 q 331 1064 321 1040 l 462 1064 q 492 1013 472 1040 q 535 958 512 986 q 581 905 558 931 q 622 860 605 879 l 622 842 "},"Ė":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 325 1155 q 345 1214 325 1196 q 396 1233 366 1233 q 425 1228 411 1233 q 448 1214 438 1224 q 463 1190 457 1205 q 469 1155 469 1176 q 448 1097 469 1116 q 396 1078 426 1078 q 345 1096 366 1078 q 325 1155 325 1115 "},"г":{"x_min":118,"x_max":527,"ha":555,"o":"m 527 642 l 241 642 l 241 0 l 118 0 l 118 745 l 527 745 l 527 642 "},"Ŀ":{"x_min":135,"x_max":649.4375,"ha":682,"o":"m 135 0 l 135 992 l 261 992 l 261 111 l 649 111 l 649 0 l 135 0 m 436 493 q 456 552 436 534 q 507 571 477 571 q 536 566 522 571 q 559 552 549 562 q 574 528 568 543 q 580 493 580 514 q 559 435 580 454 q 507 416 537 416 q 456 434 477 416 q 436 493 436 453 "},"х":{"x_min":24,"x_max":670,"ha":695,"o":"m 276 382 l 38 745 l 178 745 l 347 466 l 517 745 l 658 745 l 416 382 l 670 0 l 529 0 l 347 295 l 164 0 l 24 0 l 276 382 "},"ŋ":{"x_min":118,"x_max":706.34375,"ha":818,"o":"m 508 -334 q 454 -329 476 -334 q 418 -317 433 -324 l 418 -217 q 453 -227 435 -224 q 495 -231 472 -231 q 529 -226 513 -231 q 556 -208 545 -221 q 575 -172 568 -194 q 581 -116 581 -150 l 582 479 q 547 611 582 567 q 435 655 511 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 456 758 424 758 q 643 693 580 758 q 706 486 706 628 l 705 -107 q 693 -201 705 -159 q 657 -272 681 -243 q 596 -318 633 -302 q 508 -334 559 -334 "},"Ч":{"x_min":113,"x_max":782,"ha":917,"o":"m 782 0 l 655 0 l 655 406 q 511 360 577 376 q 379 345 445 345 q 266 361 316 345 q 183 410 217 378 q 130 489 148 442 q 113 596 113 536 l 113 992 l 239 992 l 239 612 q 274 495 239 534 q 393 456 310 456 q 517 469 454 456 q 655 510 579 483 l 655 992 l 782 992 l 782 0 "},"ü":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 210 945 q 228 998 210 982 q 275 1015 247 1015 q 321 998 301 1015 q 340 945 340 981 q 321 892 340 909 q 275 876 301 876 q 228 892 247 876 q 210 945 210 909 m 464 945 q 483 998 464 982 q 529 1015 502 1015 q 554 1010 542 1015 q 575 998 566 1006 q 589 977 584 989 q 595 945 595 964 q 575 892 595 909 q 529 876 555 876 q 483 892 502 876 q 464 945 464 909 "},"ь":{"x_min":118,"x_max":711,"ha":787,"o":"m 241 439 l 429 439 q 641 386 572 439 q 711 227 711 333 q 695 133 711 175 q 644 61 679 91 q 556 15 610 31 q 426 0 502 0 l 118 0 l 118 745 l 241 745 l 241 439 m 241 336 l 241 102 l 416 102 q 485 108 454 102 q 539 127 516 113 q 574 164 561 141 q 587 219 587 186 q 576 275 587 252 q 543 311 565 297 q 489 330 521 325 q 413 336 456 336 l 241 336 "},"Ÿ":{"x_min":-0.25,"x_max":731.25,"ha":732,"o":"m 364 490 l 595 992 l 731 992 l 428 386 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 364 490 m 174 1174 q 192 1227 174 1211 q 239 1244 211 1244 q 285 1227 265 1244 q 304 1174 304 1210 q 285 1121 304 1138 q 239 1105 265 1105 q 192 1121 211 1105 q 174 1174 174 1138 m 428 1174 q 447 1227 428 1211 q 493 1244 466 1244 q 518 1239 506 1244 q 539 1227 530 1235 q 553 1206 548 1218 q 559 1174 559 1193 q 539 1121 559 1138 q 493 1105 519 1105 q 447 1121 466 1105 q 428 1174 428 1138 "},"€":{"x_min":42.984375,"x_max":744.875,"ha":765,"o":"m 526 893 q 440 875 480 893 q 368 825 400 858 q 313 743 336 791 q 279 634 291 695 l 571 634 l 571 526 l 268 526 q 268 509 268 517 q 267 494 267 502 q 267 481 267 487 q 267 458 267 470 q 268 434 267 446 l 529 434 l 529 326 l 281 326 q 367 155 304 214 q 530 97 429 97 q 627 107 581 97 q 713 135 673 118 l 713 26 q 627 -3 672 7 q 521 -14 582 -14 q 381 9 443 -14 q 273 77 319 33 q 198 184 228 121 q 154 326 168 247 l 42 326 l 42 434 l 143 434 q 142 456 142 447 q 142 481 142 464 q 142 508 142 494 q 143 526 143 521 l 42 526 l 42 634 l 151 634 q 193 787 163 718 q 269 904 223 855 q 377 979 314 953 q 517 1006 439 1006 q 637 991 582 1006 q 744 943 691 976 l 690 844 q 615 879 656 865 q 526 893 575 893 "},"в":{"x_min":118,"x_max":711,"ha":787,"o":"m 687 557 q 645 447 687 486 q 531 395 603 407 l 531 390 q 602 373 569 385 q 659 340 635 361 q 697 289 683 320 q 711 215 711 258 q 695 130 711 169 q 644 61 679 91 q 556 16 610 32 q 426 0 502 0 l 118 0 l 118 745 l 424 745 q 529 735 481 745 q 612 704 577 726 q 667 646 647 682 q 687 557 687 610 m 587 224 q 543 312 587 287 q 413 336 500 336 l 241 336 l 241 102 l 416 102 q 485 108 454 102 q 539 128 516 114 q 574 166 561 143 q 587 224 587 190 m 570 545 q 533 620 570 598 q 422 642 496 642 l 241 642 l 241 439 l 401 439 q 475 444 443 439 q 527 461 506 449 q 559 494 549 473 q 570 545 570 515 "},"Η":{"x_min":135,"x_max":839,"ha":974,"o":"m 839 0 l 712 0 l 712 462 l 261 462 l 261 0 l 135 0 l 135 992 l 261 992 l 261 574 l 712 574 l 712 992 l 839 992 l 839 0 "},"С":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 406 867 465 894 q 305 788 347 839 q 241 662 264 736 q 218 496 218 588 q 238 326 218 400 q 298 200 258 251 q 398 123 338 150 q 538 97 458 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 "},"ß":{"x_min":118,"x_max":774,"ha":836,"o":"m 685 854 q 670 785 685 815 q 633 730 655 755 q 586 685 612 706 q 538 646 560 665 q 502 609 517 627 q 487 570 487 591 q 492 545 487 556 q 510 521 497 534 q 547 491 523 507 q 610 448 571 474 q 679 399 649 423 q 730 347 709 374 q 762 286 751 319 q 774 211 774 254 q 755 110 774 152 q 701 39 736 67 q 619 0 667 12 q 514 -14 571 -14 q 401 -2 448 -14 q 318 32 353 9 l 318 145 q 357 124 335 134 q 404 106 379 114 q 454 93 428 98 q 505 88 480 88 q 571 96 543 88 q 616 120 598 105 q 642 156 634 135 q 650 205 650 178 q 644 249 650 229 q 624 288 639 269 q 585 327 609 307 q 522 370 560 347 q 450 421 479 397 q 403 466 422 444 q 378 513 385 489 q 371 565 371 537 q 385 629 371 602 q 420 677 399 655 q 466 716 441 698 q 512 754 490 735 q 547 797 533 774 q 561 849 561 820 q 550 899 561 878 q 518 933 539 920 q 469 954 498 947 q 406 960 441 960 q 343 954 373 960 q 290 931 313 947 q 254 887 268 915 q 241 814 241 858 l 241 0 l 118 0 l 118 814 q 139 932 118 884 q 199 1009 160 980 q 290 1050 237 1037 q 405 1063 343 1063 q 519 1050 467 1063 q 607 1011 571 1037 q 664 946 644 985 q 685 854 685 906 "},"њ":{"x_min":118,"x_max":1121,"ha":1197,"o":"m 241 745 l 241 437 l 554 437 l 554 745 l 677 745 l 677 439 l 837 439 q 1051 386 982 439 q 1121 228 1121 333 q 1105 133 1121 176 q 1054 61 1089 91 q 966 15 1020 31 q 835 0 912 0 l 554 0 l 554 334 l 241 334 l 241 0 l 118 0 l 118 745 l 241 745 m 997 220 q 986 276 997 253 q 953 312 975 298 q 898 332 931 326 q 823 337 865 337 l 677 337 l 677 102 l 826 102 q 894 108 863 102 q 948 128 925 114 q 984 164 971 142 q 997 220 997 187 "},"Ű":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 273 1089 q 303 1134 287 1108 q 335 1187 319 1160 q 365 1242 351 1215 q 391 1293 380 1269 l 526 1293 l 526 1278 q 493 1233 515 1260 q 446 1175 472 1205 q 392 1118 420 1146 q 341 1071 365 1089 l 273 1071 l 273 1089 m 519 1089 q 549 1134 533 1108 q 581 1187 565 1160 q 611 1242 597 1215 q 636 1293 626 1269 l 771 1293 l 771 1278 q 738 1233 760 1260 q 691 1175 717 1205 q 637 1118 665 1146 q 586 1071 610 1089 l 519 1071 l 519 1089 "},"c":{"x_min":77,"x_max":596,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 253 581 302 650 q 204 369 204 513 q 253 160 204 226 q 402 93 302 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 "},"¶":{"x_min":77,"x_max":764,"ha":910,"o":"m 764 -176 l 682 -176 l 682 947 l 541 947 l 541 -176 l 460 -176 l 460 379 q 361 366 418 366 q 244 384 296 366 q 154 441 191 401 q 97 546 117 481 q 77 706 77 611 q 99 872 77 806 q 161 980 121 939 q 258 1038 201 1021 q 382 1055 314 1055 l 764 1055 l 764 -176 "},"Ή":{"x_min":-17,"x_max":922,"ha":1057,"o":"m 922 0 l 795 0 l 795 462 l 344 462 l 344 0 l 218 0 l 218 992 l 344 992 l 344 574 l 795 574 l 795 992 l 922 992 l 922 0 m -17 789 q -3 835 -10 809 q 9 889 3 861 q 21 943 16 916 q 30 993 27 970 l 165 993 l 165 978 q 149 936 160 962 q 123 880 138 909 q 90 821 107 850 q 56 771 72 792 l -17 771 l -17 789 "},"Ὅ":{"x_min":-203,"x_max":1001,"ha":1087,"o":"m 1001 496 q 973 287 1001 382 q 891 126 946 193 q 757 22 837 59 q 571 -14 676 -14 q 380 22 461 -14 q 245 126 299 59 q 166 288 192 193 q 141 498 141 382 q 166 707 141 613 q 246 867 192 801 q 381 970 299 934 q 573 1007 462 1007 q 757 970 678 1007 q 891 867 837 934 q 973 706 946 800 q 1001 496 1001 612 m 274 497 q 292 330 274 404 q 346 204 309 255 q 438 124 382 152 q 571 97 494 97 q 704 124 649 97 q 797 204 760 152 q 850 330 833 255 q 867 497 867 404 q 850 664 867 590 q 797 789 833 738 q 705 868 761 840 q 573 895 650 895 q 439 868 495 895 q 346 789 383 840 q 292 664 309 738 q 274 497 274 590 m -10 787 q 5 833 -2 807 q 22 885 14 858 q 38 939 30 911 q 50 991 45 966 l 191 991 l 191 977 q 162 929 178 955 q 127 876 146 903 q 87 822 108 849 q 45 770 66 795 l -10 770 l -10 787 m -203 851 q -162 942 -203 904 q -38 1003 -121 981 l -38 951 q -98 920 -79 936 q -118 889 -118 905 q -107 870 -118 876 q -84 858 -97 864 q -61 844 -72 853 q -51 816 -51 835 q -67 778 -51 791 q -116 765 -84 765 q -179 788 -156 765 q -203 851 -203 812 "},"γ":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 412 12 q 385 -76 397 -30 q 365 -167 373 -122 q 352 -255 356 -213 q 348 -334 348 -298 l 220 -334 q 225 -264 220 -305 q 240 -176 230 -223 q 262 -82 249 -130 q 289 8 274 -34 l 6 745 l 134 745 l 282 349 q 301 291 291 322 q 320 229 312 259 q 336 171 329 198 q 346 126 343 144 l 350 126 q 360 171 353 143 q 375 230 367 199 q 393 292 383 262 q 409 345 402 323 l 544 745 l 672 745 l 412 12 "},"­":{"x_min":56,"x_max":392,"ha":447,"o":"m 56 315 l 56 429 l 392 429 l 392 315 l 56 315 "},":":{"x_min":100,"x_max":272,"ha":372,"o":"m 100 74 q 106 118 100 100 q 125 147 113 136 q 152 163 136 158 q 186 169 167 169 q 219 163 203 169 q 246 147 235 158 q 265 118 258 136 q 272 74 272 100 q 265 31 272 49 q 246 2 258 13 q 219 -14 235 -9 q 186 -20 203 -20 q 152 -14 167 -20 q 125 2 136 -9 q 106 31 113 13 q 100 74 100 49 m 100 669 q 106 714 100 696 q 125 743 113 732 q 152 759 136 754 q 186 764 167 764 q 219 759 203 764 q 246 743 235 754 q 265 714 258 732 q 272 669 272 696 q 265 626 272 644 q 246 597 258 609 q 219 580 235 585 q 186 575 203 575 q 152 580 167 575 q 125 597 136 585 q 106 626 113 609 q 100 669 100 644 "},"ś":{"x_min":61.15625,"x_max":564,"ha":627,"o":"m 564 203 q 544 108 564 149 q 487 40 524 68 q 398 0 450 13 q 281 -14 346 -14 q 154 -2 207 -14 q 61 33 101 9 l 61 146 q 107 125 82 135 q 161 106 133 114 q 219 93 189 98 q 279 88 249 88 q 353 95 323 88 q 403 116 384 103 q 431 150 423 130 q 440 194 440 170 q 433 232 440 215 q 409 265 427 249 q 360 299 391 282 q 280 337 329 316 q 193 378 232 358 q 127 424 154 399 q 86 482 100 449 q 72 560 72 515 q 90 645 72 608 q 143 707 109 682 q 224 745 177 732 q 330 758 272 758 q 451 743 396 758 q 554 706 505 729 l 512 606 q 422 641 468 626 q 329 655 376 655 q 228 632 261 655 q 195 568 195 610 q 203 526 195 544 q 229 493 210 509 q 279 461 248 477 q 358 426 311 445 q 444 385 406 405 q 509 339 482 365 q 549 281 535 314 q 564 203 564 249 m 242 860 q 272 905 256 879 q 304 958 288 931 q 335 1013 320 986 q 360 1064 349 1040 l 509 1064 l 509 1049 q 476 1004 498 1031 q 429 946 455 976 q 375 889 403 917 q 324 842 347 860 l 242 842 l 242 860 "}," ":{"x_min":0,"x_max":0,"ha":361},"У":{"x_min":16.75,"x_max":813.25,"ha":813,"o":"m 813 992 l 522 289 q 468 172 496 227 q 402 75 440 116 q 311 10 364 34 q 183 -14 258 -14 q 117 -8 148 -14 q 62 6 87 -3 l 62 131 q 117 106 87 116 q 183 97 147 97 q 246 105 219 97 q 297 130 274 112 q 338 178 319 149 q 376 250 357 207 l 16 992 l 155 992 l 415 440 q 422 425 418 433 q 428 408 425 417 q 434 391 431 399 q 440 377 437 383 l 441 377 q 447 394 443 383 q 455 416 451 404 q 462 437 458 427 q 468 451 466 447 l 679 992 l 813 992 "},"¾":{"x_min":21,"x_max":1008.765625,"ha":1023,"o":"m 400 852 q 372 764 400 800 q 298 712 345 729 q 388 660 358 697 q 418 571 418 624 q 404 496 418 530 q 362 437 390 461 q 291 399 334 413 q 190 386 249 386 q 101 394 143 386 q 21 423 59 402 l 21 514 q 110 481 64 493 q 192 469 155 469 q 290 497 260 469 q 321 575 321 525 q 283 648 321 625 q 179 671 246 671 l 111 671 l 111 745 l 179 745 q 273 771 244 745 q 303 839 303 797 q 296 876 303 860 q 277 901 289 891 q 248 915 264 911 q 213 920 232 920 q 138 907 172 920 q 69 870 105 894 l 22 935 q 62 963 41 951 q 106 985 83 976 q 155 998 129 993 q 210 1004 180 1004 q 293 992 257 1004 q 352 961 328 981 q 388 913 376 940 q 400 852 400 885 m 879 992 l 328 0 l 221 0 l 772 992 l 879 992 m 1008 133 l 923 133 l 923 0 l 827 0 l 827 133 l 572 133 l 572 208 l 828 599 l 923 599 l 923 217 l 1008 217 l 1008 133 m 827 217 l 827 368 q 828 439 827 400 q 831 515 829 477 q 820 492 827 507 q 806 462 813 478 q 790 430 798 445 q 775 403 782 414 l 668 217 l 827 217 "},"Ί":{"x_min":-17,"x_max":585.8125,"ha":642,"o":"m 585 0 l 226 0 l 226 69 l 343 96 l 343 895 l 226 922 l 226 992 l 585 992 l 585 922 l 469 895 l 469 96 l 585 69 l 585 0 m -17 789 q -3 835 -10 809 q 9 889 3 861 q 21 943 16 916 q 30 993 27 970 l 165 993 l 165 978 q 149 936 160 962 q 123 880 138 909 q 90 821 107 850 q 56 771 72 792 l -17 771 l -17 789 "},"ŉ":{"x_min":0,"x_max":804,"ha":916,"o":"m 680 0 l 680 479 q 644 611 680 567 q 533 655 609 655 q 440 637 478 655 q 380 585 403 620 q 348 501 358 551 q 338 385 338 450 l 338 0 l 215 0 l 215 745 l 315 745 l 333 644 l 339 644 q 380 694 356 673 q 431 730 403 715 q 490 751 459 744 q 554 758 521 758 q 741 693 678 758 q 804 486 804 628 l 804 0 l 680 0 m 203 992 l 212 977 q 189 898 202 939 q 160 815 176 857 q 127 731 144 772 q 92 652 109 690 l 0 652 q 22 737 10 692 q 44 827 33 782 q 63 913 54 871 q 78 992 72 956 l 203 992 "},"Ģ":{"x_min":85,"x_max":858,"ha":958,"o":"m 530 524 l 858 524 l 858 36 q 782 15 820 24 q 704 0 744 5 q 620 -10 664 -7 q 526 -14 576 -14 q 337 21 419 -14 q 199 123 255 57 q 114 284 143 189 q 85 497 85 378 q 117 708 85 613 q 211 868 149 802 q 363 970 272 934 q 569 1006 453 1006 q 713 991 644 1006 q 842 947 782 976 l 793 837 q 741 859 769 849 q 683 877 713 869 q 621 890 653 885 q 559 894 590 894 q 412 867 476 894 q 306 788 349 839 q 240 662 263 736 q 218 496 218 588 q 237 334 218 407 q 296 208 255 261 q 401 126 336 155 q 556 97 465 97 q 610 98 585 97 q 656 103 635 100 q 695 109 677 106 q 731 116 714 113 l 731 412 l 530 412 l 530 524 m 437 -288 q 453 -246 444 -271 q 470 -191 462 -220 q 484 -135 478 -163 q 493 -85 491 -107 l 616 -85 l 616 -98 q 601 -141 611 -115 q 575 -197 590 -167 q 541 -255 560 -226 q 503 -307 523 -284 l 437 -307 l 437 -288 "},"m":{"x_min":118,"x_max":1134,"ha":1245,"o":"m 1010 0 l 1010 479 q 976 611 1010 567 q 871 655 942 655 q 786 639 821 655 q 729 592 752 623 q 697 516 707 562 q 687 410 687 470 l 687 0 l 564 0 l 564 479 q 530 611 564 567 q 425 655 496 655 q 337 637 373 655 q 281 585 302 620 q 250 501 259 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 281 694 259 673 q 330 730 303 715 q 387 751 357 744 q 448 758 417 758 q 584 728 530 758 q 663 634 637 698 l 669 634 q 711 689 686 666 q 765 727 736 712 q 828 750 795 743 q 894 758 860 758 q 1073 693 1013 758 q 1134 486 1134 628 l 1134 0 l 1010 0 "},"Е":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 "},"ž":{"x_min":56,"x_max":556.21875,"ha":612,"o":"m 556 0 l 56 0 l 56 80 l 418 656 l 78 656 l 78 745 l 544 745 l 544 650 l 189 88 l 556 88 l 556 0 m 542 1045 q 501 1000 525 1026 q 455 947 478 974 q 412 892 432 919 q 382 842 392 865 l 251 842 q 221 892 241 865 q 178 947 201 919 q 132 1000 155 974 q 92 1045 109 1026 l 92 1064 l 174 1064 q 244 1008 208 1041 q 317 937 280 975 q 388 1008 352 975 q 460 1064 425 1041 l 542 1064 l 542 1045 "},"á":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 302 860 q 332 905 316 879 q 364 958 348 931 q 395 1013 380 986 q 420 1064 409 1040 l 569 1064 l 569 1049 q 536 1004 558 1031 q 489 946 515 976 q 435 889 463 917 q 384 842 407 860 l 302 842 l 302 860 "},"×":{"x_min":95.28125,"x_max":670.421875,"ha":765,"o":"m 310 490 l 95 706 l 166 778 l 381 562 l 599 778 l 670 708 l 452 490 l 669 273 l 599 204 l 381 419 l 166 205 l 96 275 l 310 490 "},"п":{"x_min":118,"x_max":706,"ha":825,"o":"m 241 0 l 118 0 l 118 745 l 706 745 l 706 0 l 582 0 l 582 642 l 241 642 l 241 0 "},"Ǻ":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 575 974 q 554 894 575 926 q 499 844 534 861 l 844 0 l 715 0 l 610 266 l 233 266 l 127 0 l 0 0 l 341 843 q 287 892 307 860 q 268 972 268 925 q 278 1034 268 1007 q 309 1080 289 1061 q 357 1109 329 1099 q 419 1119 385 1119 q 480 1109 452 1119 q 530 1080 509 1099 q 563 1035 551 1061 q 575 974 575 1008 m 566 378 l 466 636 q 456 662 462 647 q 444 696 450 678 q 432 734 438 714 q 421 773 426 754 q 410 734 416 754 q 397 695 404 714 q 386 662 391 677 q 376 636 380 646 l 277 378 l 566 378 m 368 1166 q 398 1203 382 1182 q 430 1246 414 1224 q 460 1290 446 1268 q 486 1331 475 1311 l 635 1331 l 635 1320 q 602 1283 624 1305 q 555 1236 581 1261 q 501 1190 528 1212 q 450 1153 473 1167 l 368 1153 l 368 1166 m 500 973 q 478 1029 500 1008 q 421 1049 456 1049 q 364 1029 386 1049 q 342 973 342 1008 q 360 918 342 938 q 412 896 378 898 l 421 896 q 478 916 456 896 q 500 973 500 937 "},"K":{"x_min":135,"x_max":804.25,"ha":804,"o":"m 804 0 l 661 0 l 355 473 l 261 396 l 261 0 l 135 0 l 135 992 l 261 992 l 261 496 l 343 609 l 649 992 l 791 992 l 438 559 l 804 0 "},"7":{"x_min":61,"x_max":699,"ha":765,"o":"m 190 0 l 572 879 l 61 879 l 61 992 l 699 992 l 699 893 l 322 0 l 190 0 "},"¨":{"x_min":208,"x_max":593,"ha":802,"o":"m 208 945 q 226 998 208 982 q 273 1015 245 1015 q 319 998 299 1015 q 338 945 338 981 q 319 892 338 909 q 273 876 299 876 q 226 892 245 876 q 208 945 208 909 m 462 945 q 481 998 462 982 q 527 1015 500 1015 q 552 1010 540 1015 q 573 998 564 1006 q 587 977 582 989 q 593 945 593 964 q 573 892 593 909 q 527 876 553 876 q 481 892 500 876 q 462 945 462 909 "},"Y":{"x_min":-0.25,"x_max":731.25,"ha":732,"o":"m 364 490 l 595 992 l 731 992 l 428 386 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 364 490 "},"E":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 "},"Ô":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 744 1071 l 662 1071 q 590 1126 627 1093 q 519 1196 554 1159 q 446 1126 482 1159 q 376 1071 410 1093 l 294 1071 l 294 1089 q 334 1134 311 1108 q 380 1187 357 1160 q 423 1242 403 1215 q 453 1293 443 1269 l 584 1293 q 614 1242 594 1269 q 657 1187 634 1215 q 703 1134 680 1160 q 744 1089 727 1108 l 744 1071 "},"Є":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 419 872 473 894 q 324 809 365 850 q 257 708 283 767 q 222 574 231 649 l 649 574 l 649 462 l 218 462 q 243 307 222 374 q 305 192 265 239 q 403 121 345 145 q 538 97 461 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 "},"Ï":{"x_min":43,"x_max":428,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 43 1174 q 61 1227 43 1211 q 108 1244 80 1244 q 154 1227 134 1244 q 173 1174 173 1210 q 154 1121 173 1138 q 108 1105 134 1105 q 61 1121 80 1105 q 43 1174 43 1138 m 297 1174 q 316 1227 297 1211 q 362 1244 335 1244 q 387 1239 375 1244 q 408 1227 399 1235 q 422 1206 417 1218 q 428 1174 428 1193 q 408 1121 428 1138 q 362 1105 388 1105 q 316 1121 335 1105 q 297 1174 297 1138 "},"ġ":{"x_min":25,"x_max":692.484375,"ha":720,"o":"m 692 745 l 692 668 l 559 649 q 591 588 578 625 q 604 504 604 551 q 588 409 604 453 q 539 333 572 365 q 459 283 507 301 q 348 266 412 266 q 319 266 333 266 q 294 268 304 266 q 271 253 282 261 q 251 233 260 244 q 236 208 242 222 q 230 178 230 194 q 238 148 230 159 q 260 130 246 136 q 293 122 274 124 q 333 120 312 120 l 453 120 q 560 104 516 120 q 631 61 603 88 q 670 -2 658 34 q 683 -80 683 -38 q 660 -186 683 -139 q 593 -266 638 -233 q 478 -316 547 -298 q 314 -334 408 -334 q 187 -319 241 -334 q 96 -278 132 -305 q 42 -213 60 -251 q 25 -128 25 -175 q 38 -57 25 -87 q 73 -4 51 -26 q 125 32 96 17 q 187 53 155 46 q 140 94 158 66 q 122 159 122 122 q 143 231 122 201 q 212 291 165 262 q 158 324 182 303 q 118 373 134 346 q 92 433 101 401 q 83 500 83 466 q 99 608 83 561 q 150 689 116 656 q 233 740 183 722 q 348 758 282 758 q 400 754 373 758 q 445 745 427 750 l 692 745 m 141 -126 q 150 -173 141 -151 q 179 -211 159 -195 q 232 -235 199 -226 q 314 -245 265 -245 q 503 -205 440 -245 q 566 -92 566 -166 q 558 -41 566 -61 q 531 -10 550 -21 q 482 4 512 0 q 407 8 451 8 l 287 8 q 238 3 263 8 q 190 -17 212 -2 q 155 -58 169 -32 q 141 -126 141 -84 m 206 504 q 242 388 206 426 q 344 350 278 350 q 446 388 411 350 q 480 506 480 426 q 445 629 480 590 q 343 669 410 669 q 241 628 277 669 q 206 504 206 587 m 273 945 q 293 1004 273 986 q 344 1023 314 1023 q 373 1018 359 1023 q 396 1004 386 1014 q 411 980 405 995 q 417 945 417 966 q 396 887 417 906 q 344 868 374 868 q 293 886 314 868 q 273 945 273 905 "},"έ":{"x_min":61,"x_max":583,"ha":629,"o":"m 453 439 l 453 336 l 366 336 q 229 305 273 336 q 184 210 184 274 q 198 152 184 176 q 235 114 212 129 q 291 94 259 100 q 360 88 323 88 q 426 93 395 88 q 484 106 457 98 q 535 125 511 114 q 580 146 559 135 l 580 37 q 486 0 540 14 q 359 -14 433 -14 q 226 2 282 -14 q 133 48 170 19 q 78 117 96 77 q 61 203 61 157 q 73 275 61 245 q 108 326 86 305 q 157 361 129 347 q 215 385 185 375 l 215 392 q 162 416 185 402 q 121 452 138 431 q 94 500 103 473 q 85 561 85 527 q 104 645 85 608 q 159 707 124 682 q 244 745 195 732 q 351 758 293 758 q 417 754 387 758 q 475 745 448 751 q 529 729 503 739 q 583 706 555 720 l 540 606 q 445 642 489 629 q 353 655 401 655 q 240 629 279 655 q 201 551 201 603 q 214 499 201 520 q 252 464 228 477 q 311 445 277 451 q 386 439 345 439 l 453 439 m 305 860 q 318 906 311 880 q 331 960 325 932 q 343 1014 338 987 q 352 1064 349 1041 l 487 1064 l 487 1049 q 471 1007 482 1033 q 445 951 460 980 q 412 892 429 921 q 378 842 394 863 l 305 842 l 305 860 "}," ":{"x_min":0,"x_max":0,"ha":463},"ϋ":{"x_min":111,"x_max":736,"ha":819,"o":"m 409 -14 q 264 13 322 -14 q 172 87 206 40 q 124 199 138 135 q 111 337 111 263 l 111 745 l 234 745 l 234 345 q 245 239 234 286 q 278 158 256 192 q 335 106 300 125 q 417 88 370 88 q 564 167 516 88 q 612 412 612 245 q 609 503 612 461 q 601 585 606 545 q 587 664 595 625 q 569 745 580 703 l 693 745 q 711 664 703 703 q 725 585 719 626 q 733 501 730 545 q 736 406 736 457 q 653 88 736 190 q 409 -14 570 -14 m 208 945 q 226 998 208 982 q 273 1015 245 1015 q 319 998 299 1015 q 338 945 338 981 q 319 892 338 909 q 273 876 299 876 q 226 892 245 876 q 208 945 208 909 m 462 945 q 481 998 462 982 q 527 1015 500 1015 q 552 1010 540 1015 q 573 998 564 1006 q 587 977 582 989 q 593 945 593 964 q 573 892 593 909 q 527 876 553 876 q 481 892 500 876 q 462 945 462 909 "},"й":{"x_min":118,"x_max":735,"ha":853,"o":"m 234 745 l 234 291 l 226 120 l 576 745 l 735 745 l 735 0 l 618 0 l 618 439 l 625 622 l 276 0 l 118 0 l 118 745 l 234 745 m 686 1058 q 665 964 681 1005 q 617 897 648 924 q 537 855 585 869 q 421 842 489 842 q 304 855 352 842 q 227 895 256 868 q 183 963 197 922 q 166 1058 169 1003 l 281 1058 q 293 990 284 1016 q 320 949 303 964 q 362 929 337 934 q 424 923 388 923 q 479 930 454 923 q 522 952 504 937 q 552 993 540 968 q 567 1058 563 1019 l 686 1058 "},"b":{"x_min":118,"x_max":737,"ha":814,"o":"m 454 758 q 570 733 518 758 q 659 660 622 709 q 716 540 696 612 q 737 373 737 468 q 716 205 737 277 q 659 84 696 133 q 570 10 622 35 q 454 -14 518 -14 q 381 -5 414 -14 q 323 18 349 3 q 277 52 297 32 q 241 93 257 72 l 233 93 l 208 0 l 118 0 l 118 1055 l 241 1055 l 241 800 q 240 749 241 776 q 238 699 240 722 q 236 646 237 672 l 241 646 q 276 690 257 670 q 322 726 296 711 q 381 749 348 741 q 454 758 413 758 m 430 655 q 340 638 376 655 q 281 585 303 621 q 250 497 259 550 q 241 373 241 444 q 250 251 241 304 q 281 162 259 198 q 340 107 303 125 q 431 88 377 88 q 566 162 523 88 q 609 374 609 236 q 566 585 609 515 q 430 655 523 655 "},"ύ":{"x_min":111,"x_max":736,"ha":819,"o":"m 409 -14 q 264 13 322 -14 q 172 87 206 40 q 124 199 138 135 q 111 337 111 263 l 111 745 l 234 745 l 234 345 q 245 239 234 286 q 278 158 256 192 q 335 106 300 125 q 417 88 370 88 q 564 167 516 88 q 612 412 612 245 q 609 503 612 461 q 601 585 606 545 q 587 664 595 625 q 569 745 580 703 l 693 745 q 711 664 703 703 q 725 585 719 626 q 733 501 730 545 q 736 406 736 457 q 653 88 736 190 q 409 -14 570 -14 m 352 860 q 365 906 358 880 q 378 960 372 932 q 390 1014 385 987 q 399 1064 396 1041 l 534 1064 l 534 1049 q 518 1007 529 1033 q 492 951 507 980 q 459 892 476 921 q 425 842 441 863 l 352 842 l 352 860 "},"ﬂ":{"x_min":19,"x_max":698.4375,"ha":817,"o":"m 441 656 l 274 656 l 274 0 l 151 0 l 151 656 l 19 656 l 19 704 l 151 749 l 151 814 q 166 934 151 886 q 210 1010 181 982 q 280 1051 238 1039 q 375 1063 322 1063 q 449 1055 415 1063 q 509 1037 482 1047 l 477 941 q 431 954 456 949 q 379 960 406 960 q 332 954 352 960 q 300 931 313 947 q 280 887 287 915 q 274 815 274 859 l 274 745 l 441 745 l 441 656 m 698 0 l 575 0 l 575 1055 l 698 1055 l 698 0 "},"ф":{"x_min":77,"x_max":892,"ha":968,"o":"m 545 756 q 685 719 621 747 q 794 641 749 690 q 866 525 840 593 q 892 373 892 458 q 868 221 892 289 q 799 104 844 153 q 689 25 753 54 q 545 -11 625 -3 l 545 -334 l 429 -334 l 429 -11 q 286 24 351 -4 q 175 103 221 54 q 102 220 128 151 q 77 373 77 288 q 101 526 77 458 q 170 642 125 593 q 281 719 215 690 q 429 756 346 748 l 429 1055 l 545 1055 l 545 756 m 204 373 q 257 175 204 246 q 429 91 310 104 l 429 653 q 326 626 369 647 q 256 571 284 606 q 217 486 229 536 q 204 373 204 437 m 764 373 q 712 569 764 500 q 545 652 660 638 l 545 91 q 712 175 661 104 q 764 373 764 246 "},"Ŋ":{"x_min":135,"x_max":878,"ha":1013,"o":"m 615 -264 q 554 -259 580 -264 q 510 -247 528 -255 l 510 -139 q 557 -149 532 -145 q 613 -152 583 -152 q 662 -146 637 -152 q 706 -122 686 -139 q 739 -76 726 -105 q 751 0 751 -46 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 757 202 l 762 202 q 757 291 759 246 q 753 371 755 329 q 751 449 751 413 l 751 992 l 878 992 l 878 13 q 859 -109 878 -57 q 806 -196 840 -162 q 724 -247 772 -230 q 615 -264 675 -264 "},"Ũ":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 585 1072 q 531 1083 558 1072 q 479 1110 505 1095 q 429 1136 453 1124 q 384 1148 405 1148 q 337 1130 353 1148 q 311 1070 321 1112 l 241 1070 q 255 1144 244 1111 q 284 1201 266 1177 q 327 1237 302 1224 q 384 1250 352 1250 q 440 1238 412 1250 q 493 1211 467 1226 q 542 1185 519 1197 q 585 1173 566 1173 q 631 1191 616 1173 q 657 1251 647 1209 l 729 1251 q 714 1177 725 1210 q 685 1121 703 1144 q 642 1084 667 1097 q 585 1072 617 1072 "},"Щ":{"x_min":135,"x_max":1369,"ha":1385,"o":"m 1250 111 l 1369 111 l 1369 -261 l 1242 -261 l 1242 0 l 135 0 l 135 992 l 261 992 l 261 111 l 629 111 l 629 992 l 755 992 l 755 111 l 1123 111 l 1123 992 l 1250 992 l 1250 111 "},"L":{"x_min":135,"x_max":649.4375,"ha":682,"o":"m 135 0 l 135 992 l 261 992 l 261 111 l 649 111 l 649 0 l 135 0 "},"ď":{"x_min":77,"x_max":924,"ha":814,"o":"m 577 99 l 572 99 q 537 55 557 76 q 491 19 517 34 q 432 -5 465 3 q 359 -14 400 -14 q 244 10 296 -14 q 154 83 192 34 q 97 203 117 131 q 77 370 77 275 q 97 538 77 466 q 154 659 117 610 q 244 733 192 708 q 359 758 296 758 q 432 749 399 758 q 490 725 464 740 q 537 690 516 710 q 572 649 557 671 l 580 649 q 576 693 578 672 q 573 729 575 711 q 572 759 572 748 l 572 1055 l 696 1055 l 696 0 l 596 0 l 577 99 m 383 88 q 470 104 434 88 q 528 151 506 119 q 560 231 550 183 q 572 342 571 279 l 572 370 q 563 492 572 439 q 532 581 554 545 q 473 636 510 618 q 382 655 437 655 q 247 581 290 655 q 204 369 204 507 q 247 157 204 227 q 383 88 290 88 m 760 850 q 772 897 766 871 q 784 950 778 923 q 794 1005 789 978 q 801 1055 799 1032 l 924 1055 l 924 1041 q 909 997 919 1024 q 885 942 898 971 q 855 883 871 913 q 825 833 840 854 l 760 833 l 760 850 "},"Ο":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 "},"Ĭ":{"x_min":33,"x_max":441,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 441 1259 q 423 1183 438 1217 q 382 1123 408 1149 q 319 1084 356 1098 q 234 1071 282 1071 q 147 1084 184 1071 q 86 1122 110 1097 q 48 1181 61 1147 q 33 1259 35 1216 l 107 1259 q 119 1212 110 1229 q 145 1186 129 1194 q 184 1175 161 1177 q 237 1172 207 1172 q 283 1175 261 1172 q 323 1188 305 1178 q 352 1214 340 1197 q 366 1259 363 1231 l 441 1259 "},"ŧ":{"x_min":23,"x_max":445,"ha":471,"o":"m 343 88 q 371 89 355 88 q 400 93 386 91 q 426 97 415 95 q 445 102 438 100 l 445 8 q 422 0 436 3 q 392 -7 409 -4 q 358 -12 376 -10 q 324 -14 341 -14 q 246 -3 282 -14 q 184 34 210 8 q 142 107 157 61 q 128 222 128 153 l 128 395 l 33 395 l 33 484 l 128 484 l 128 656 l 23 656 l 23 709 l 128 759 l 180 915 l 251 915 l 251 745 l 439 745 l 439 656 l 251 656 l 251 484 l 427 484 l 427 395 l 251 395 l 251 222 q 272 122 251 155 q 343 88 294 88 "},"À":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 488 1071 l 406 1071 q 354 1118 382 1089 q 300 1175 326 1146 q 253 1233 274 1205 q 221 1278 231 1260 l 221 1293 l 369 1293 q 395 1242 380 1269 q 425 1187 409 1215 q 457 1134 441 1160 q 488 1089 473 1108 l 488 1071 "},"Ϊ":{"x_min":43,"x_max":428,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 43 1174 q 61 1227 43 1211 q 108 1244 80 1244 q 154 1227 134 1244 q 173 1174 173 1210 q 154 1121 173 1138 q 108 1105 134 1105 q 61 1121 80 1105 q 43 1174 43 1138 m 297 1174 q 316 1227 297 1211 q 362 1244 335 1244 q 387 1239 375 1244 q 408 1227 399 1235 q 422 1206 417 1218 q 428 1174 428 1193 q 408 1121 428 1138 q 362 1105 388 1105 q 316 1121 335 1105 q 297 1174 297 1138 "},"ḁ":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 512 -229 q 500 -291 512 -264 q 467 -338 488 -319 q 418 -367 446 -357 q 356 -377 389 -377 q 294 -367 322 -377 q 246 -338 266 -357 q 215 -292 226 -319 q 205 -231 205 -265 q 215 -169 205 -196 q 246 -123 226 -142 q 294 -94 266 -104 q 356 -85 322 -85 q 417 -94 389 -85 q 467 -123 446 -104 q 500 -168 488 -142 q 512 -229 512 -195 m 437 -231 q 415 -174 437 -194 q 358 -154 392 -154 q 301 -174 323 -154 q 279 -231 279 -194 q 299 -287 279 -267 q 358 -307 319 -307 q 415 -287 392 -307 q 437 -231 437 -267 "},"½":{"x_min":29,"x_max":976.734375,"ha":1023,"o":"m 194 992 l 284 992 l 284 397 l 188 397 l 188 754 q 188 792 188 771 q 189 833 188 813 q 191 873 190 854 q 193 908 192 893 q 171 881 183 895 q 143 853 158 866 l 79 799 l 29 864 l 194 992 m 801 992 l 250 0 l 143 0 l 694 992 l 801 992 m 976 0 l 588 0 l 588 75 l 730 230 q 793 300 769 272 q 832 352 818 329 q 850 394 845 374 q 856 437 856 414 q 833 502 856 481 q 774 523 810 523 q 707 506 739 523 q 645 463 675 489 l 592 527 q 673 584 628 561 q 774 607 719 607 q 848 595 815 607 q 904 563 881 584 q 940 510 927 541 q 953 440 953 479 q 942 377 953 406 q 911 318 931 347 q 862 258 891 289 q 794 190 832 227 l 684 83 l 976 83 l 976 0 "},"'":{"x_min":90,"x_max":223.609375,"ha":314,"o":"m 223 992 l 195 634 l 117 634 l 90 992 l 223 992 "},"ĳ":{"x_min":108.5,"x_max":611.96875,"ha":720,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 108 945 q 129 1004 108 986 q 180 1023 149 1023 q 208 1018 195 1023 q 231 1004 221 1014 q 247 980 241 995 q 252 945 252 966 q 231 887 252 906 q 180 868 210 868 q 129 886 149 868 q 108 945 108 905 m 403 -334 q 349 -329 371 -334 q 313 -317 328 -324 l 313 -217 q 348 -227 330 -224 q 390 -231 367 -231 q 424 -226 409 -231 q 452 -208 440 -221 q 470 -172 464 -194 q 477 -116 477 -150 l 477 745 l 600 745 l 600 -107 q 588 -201 600 -159 q 552 -272 577 -243 q 491 -318 528 -302 q 403 -334 454 -334 m 467 945 q 488 1004 467 986 q 539 1023 508 1023 q 567 1018 554 1023 q 590 1004 580 1014 q 606 980 600 995 q 611 945 611 966 q 590 887 611 906 q 539 868 569 868 q 488 886 508 868 q 467 945 467 905 "},"Р":{"x_min":135,"x_max":729,"ha":800,"o":"m 729 701 q 710 582 729 639 q 648 482 691 525 q 536 412 606 438 q 362 386 465 386 l 261 386 l 261 0 l 135 0 l 135 992 l 380 992 q 537 972 471 992 q 645 916 602 953 q 708 825 688 879 q 729 701 729 770 m 261 493 l 347 493 q 456 504 410 493 q 533 539 503 515 q 579 601 564 563 q 595 695 595 640 q 540 837 595 791 q 368 884 485 884 l 261 884 l 261 493 "},"˛":{"x_min":21,"x_max":237,"ha":257,"o":"m 118 -161 q 136 -206 118 -191 q 178 -220 154 -220 q 211 -218 195 -220 q 237 -214 227 -217 l 237 -291 q 197 -299 219 -296 q 156 -302 176 -302 q 54 -266 88 -302 q 21 -170 21 -231 q 30 -116 21 -142 q 56 -69 40 -91 q 89 -30 71 -48 q 125 0 108 -12 l 212 0 q 118 -161 118 -90 "},"Ć":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 406 867 465 894 q 305 788 347 839 q 241 662 264 736 q 218 496 218 588 q 238 326 218 400 q 298 200 258 251 q 398 123 338 150 q 538 97 458 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 m 447 1089 q 477 1134 461 1108 q 509 1187 493 1160 q 540 1242 525 1215 q 565 1293 554 1269 l 714 1293 l 714 1278 q 681 1233 703 1260 q 634 1175 660 1205 q 580 1118 608 1146 q 529 1071 552 1089 l 447 1071 l 447 1089 "},"Т":{"x_min":14,"x_max":706,"ha":721,"o":"m 423 0 l 297 0 l 297 880 l 14 880 l 14 992 l 706 992 l 706 880 l 423 880 l 423 0 "},"£":{"x_min":46,"x_max":718,"ha":765,"o":"m 451 1004 q 582 988 523 1004 q 686 948 641 972 l 641 850 q 556 884 603 869 q 457 898 508 898 q 397 889 425 898 q 349 860 370 880 q 318 809 329 840 q 307 732 307 777 l 307 534 l 561 534 l 561 437 l 307 437 l 307 295 q 299 224 307 254 q 278 173 291 194 q 248 137 265 152 q 212 112 230 123 l 718 112 l 718 0 l 46 0 l 46 103 q 100 124 75 110 q 143 161 125 138 q 171 216 161 183 q 182 294 182 249 l 182 437 l 47 437 l 47 534 l 182 534 l 182 753 q 201 859 182 812 q 257 937 221 905 q 342 987 293 970 q 451 1004 392 1004 "},"ů":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 563 989 q 551 927 563 954 q 518 880 539 899 q 469 851 497 861 q 407 842 440 842 q 345 851 373 842 q 297 880 317 861 q 266 926 277 899 q 256 988 256 953 q 266 1049 256 1022 q 297 1095 277 1076 q 345 1124 317 1114 q 407 1134 373 1134 q 468 1124 440 1134 q 518 1095 497 1114 q 551 1050 539 1076 q 563 989 563 1023 m 488 988 q 466 1044 488 1024 q 409 1064 444 1064 q 352 1044 374 1064 q 330 988 330 1024 q 350 931 330 951 q 409 911 370 911 q 466 931 444 911 q 488 988 488 951 "},"Ō":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 320 1172 l 710 1172 l 710 1071 l 320 1071 l 320 1172 "},"а":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 "},"Ğ":{"x_min":85,"x_max":858,"ha":958,"o":"m 530 524 l 858 524 l 858 36 q 782 15 820 24 q 704 0 744 5 q 620 -10 664 -7 q 526 -14 576 -14 q 337 21 419 -14 q 199 123 255 57 q 114 284 143 189 q 85 497 85 378 q 117 708 85 613 q 211 868 149 802 q 363 970 272 934 q 569 1006 453 1006 q 713 991 644 1006 q 842 947 782 976 l 793 837 q 741 859 769 849 q 683 877 713 869 q 621 890 653 885 q 559 894 590 894 q 412 867 476 894 q 306 788 349 839 q 240 662 263 736 q 218 496 218 588 q 237 334 218 407 q 296 208 255 261 q 401 126 336 155 q 556 97 465 97 q 610 98 585 97 q 656 103 635 100 q 695 109 677 106 q 731 116 714 113 l 731 412 l 530 412 l 530 524 m 740 1259 q 722 1183 737 1217 q 681 1123 707 1149 q 618 1084 655 1098 q 533 1071 581 1071 q 446 1084 483 1071 q 385 1122 409 1097 q 347 1181 360 1147 q 332 1259 334 1216 l 406 1259 q 418 1212 409 1229 q 444 1186 428 1194 q 483 1175 460 1177 q 536 1172 506 1172 q 582 1175 560 1172 q 622 1188 604 1178 q 651 1214 639 1197 q 665 1259 662 1231 l 740 1259 "},"v":{"x_min":-0.25,"x_max":665.25,"ha":665,"o":"m 254 0 l 0 745 l 127 745 l 262 330 q 280 272 269 308 q 300 200 290 237 q 319 131 310 164 q 330 82 327 99 l 335 82 q 346 131 338 99 q 364 200 354 164 q 385 272 375 237 q 402 330 395 308 l 537 745 l 665 745 l 410 0 l 254 0 "},"Ї":{"x_min":43,"x_max":428,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 43 1174 q 61 1227 43 1211 q 108 1244 80 1244 q 154 1227 134 1244 q 173 1174 173 1210 q 154 1121 173 1138 q 108 1105 134 1105 q 61 1121 80 1105 q 43 1174 43 1138 m 297 1174 q 316 1227 297 1211 q 362 1244 335 1244 q 387 1239 375 1244 q 408 1227 399 1235 q 422 1206 417 1218 q 428 1174 428 1193 q 408 1121 428 1138 q 362 1105 388 1105 q 316 1121 335 1105 q 297 1174 297 1138 "},"û":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 631 842 l 549 842 q 477 897 514 864 q 406 967 441 930 q 333 897 369 930 q 263 842 297 864 l 181 842 l 181 860 q 221 905 198 879 q 267 958 244 931 q 310 1013 290 986 q 340 1064 330 1040 l 471 1064 q 501 1013 481 1040 q 544 958 521 986 q 590 905 567 931 q 631 860 614 879 l 631 842 "},"Ź":{"x_min":56,"x_max":693,"ha":749,"o":"m 693 0 l 56 0 l 56 97 l 537 880 l 70 880 l 70 992 l 679 992 l 679 894 l 197 111 l 693 111 l 693 0 m 305 1089 q 335 1134 319 1108 q 367 1187 351 1160 q 398 1242 383 1215 q 423 1293 412 1269 l 572 1293 l 572 1278 q 539 1233 561 1260 q 492 1175 518 1205 q 438 1118 466 1146 q 387 1071 410 1089 l 305 1071 l 305 1089 "},"ˉ":{"x_min":192,"x_max":582,"ha":774,"o":"m 192 943 l 582 943 l 582 842 l 192 842 l 192 943 "},"Ĺ":{"x_min":135,"x_max":649.4375,"ha":682,"o":"m 135 0 l 135 992 l 261 992 l 261 111 l 649 111 l 649 0 l 135 0 m 161 1089 q 191 1134 175 1108 q 223 1187 207 1160 q 254 1242 239 1215 q 279 1293 268 1269 l 428 1293 l 428 1278 q 395 1233 417 1260 q 348 1175 374 1205 q 294 1118 322 1146 q 243 1071 266 1089 l 161 1071 l 161 1089 "},"₤":{"x_min":46,"x_max":718,"ha":765,"o":"m 451 1004 q 582 988 523 1004 q 686 948 641 972 l 641 850 q 556 884 603 869 q 457 898 508 898 q 397 889 425 898 q 349 860 370 880 q 318 809 329 840 q 307 733 307 777 l 307 604 l 561 604 l 561 507 l 307 507 l 307 404 l 561 404 l 561 307 l 307 307 l 307 294 q 299 223 307 253 q 278 172 291 194 q 248 137 265 151 q 212 112 230 123 l 718 112 l 718 0 l 46 0 l 46 104 q 100 125 75 111 q 143 161 125 138 q 171 216 161 184 q 182 293 182 248 l 182 307 l 47 307 l 47 404 l 182 404 l 182 507 l 47 507 l 47 604 l 182 604 l 182 753 q 201 859 182 812 q 257 937 221 905 q 342 987 293 970 q 451 1004 392 1004 "},"Č":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 406 867 465 894 q 305 788 347 839 q 241 662 264 736 q 218 496 218 588 q 238 326 218 400 q 298 200 258 251 q 398 123 338 150 q 538 97 458 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 m 739 1274 q 698 1229 722 1255 q 652 1176 675 1203 q 609 1121 629 1148 q 579 1071 589 1094 l 448 1071 q 418 1121 438 1094 q 375 1176 398 1148 q 329 1229 352 1203 q 289 1274 306 1255 l 289 1293 l 371 1293 q 441 1237 405 1270 q 514 1166 477 1204 q 585 1237 549 1204 q 657 1293 622 1270 l 739 1293 l 739 1274 "},"x":{"x_min":24,"x_max":670,"ha":695,"o":"m 276 382 l 38 745 l 178 745 l 347 466 l 517 745 l 658 745 l 416 382 l 670 0 l 529 0 l 347 295 l 164 0 l 24 0 l 276 382 "},"è":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 461 842 l 379 842 q 327 889 355 860 q 273 946 299 917 q 226 1004 247 976 q 194 1049 204 1031 l 194 1064 l 342 1064 q 368 1013 353 1040 q 398 958 382 986 q 430 905 414 931 q 461 860 446 879 l 461 842 "},"Ń":{"x_min":135,"x_max":878,"ha":1013,"o":"m 878 0 l 724 0 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 757 174 l 762 174 q 757 276 759 226 q 755 321 756 298 q 753 366 754 343 q 752 410 752 389 q 751 449 751 431 l 751 992 l 878 992 l 878 0 m 431 1089 q 461 1134 445 1108 q 493 1187 477 1160 q 524 1242 509 1215 q 549 1293 538 1269 l 698 1293 l 698 1278 q 665 1233 687 1260 q 618 1175 644 1205 q 564 1118 592 1146 q 513 1071 536 1089 l 431 1071 l 431 1089 "},"ḿ":{"x_min":118,"x_max":1134,"ha":1245,"o":"m 1010 0 l 1010 479 q 976 611 1010 567 q 871 655 942 655 q 786 639 821 655 q 729 592 752 623 q 697 516 707 562 q 687 410 687 470 l 687 0 l 564 0 l 564 479 q 530 611 564 567 q 425 655 496 655 q 337 637 373 655 q 281 585 302 620 q 250 501 259 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 281 694 259 673 q 330 730 303 715 q 387 751 357 744 q 448 758 417 758 q 584 728 530 758 q 663 634 637 698 l 669 634 q 711 689 686 666 q 765 727 736 712 q 828 750 795 743 q 894 758 860 758 q 1073 693 1013 758 q 1134 486 1134 628 l 1134 0 l 1010 0 m 575 860 q 605 905 589 879 q 637 958 621 931 q 668 1013 653 986 q 693 1064 682 1040 l 842 1064 l 842 1049 q 809 1004 831 1031 q 762 946 788 976 q 708 889 736 917 q 657 842 680 860 l 575 842 l 575 860 "},"μ":{"x_min":118,"x_max":706,"ha":825,"o":"m 241 264 q 277 132 241 176 q 388 88 313 88 q 481 106 443 88 q 540 158 518 123 q 573 242 563 192 q 582 357 582 292 l 582 745 l 706 745 l 706 0 l 606 0 l 588 99 l 581 99 q 500 14 548 42 q 381 -14 451 -14 q 296 1 332 -14 q 237 45 261 17 q 239 -7 238 19 q 241 -59 240 -30 q 241 -117 241 -88 l 241 -334 l 118 -334 l 118 745 l 241 745 l 241 264 "},".":{"x_min":100,"x_max":272,"ha":372,"o":"m 100 74 q 106 118 100 100 q 125 147 113 136 q 152 163 136 158 q 186 169 167 169 q 219 163 203 169 q 246 147 235 158 q 265 118 258 136 q 272 74 272 100 q 265 31 272 49 q 246 2 258 13 q 219 -14 235 -9 q 186 -20 203 -20 q 152 -14 167 -20 q 125 2 136 -9 q 106 31 113 13 q 100 74 100 49 "},"‘":{"x_min":16,"x_max":228,"ha":243,"o":"m 24 652 l 16 666 q 38 744 25 703 q 67 828 51 786 q 100 912 82 870 q 135 992 118 954 l 228 992 q 204 905 216 950 q 183 816 193 861 q 164 730 173 772 q 149 652 155 687 l 24 652 "},"π":{"x_min":17.109375,"x_max":831,"ha":875,"o":"m 749 88 q 783 92 767 88 q 810 102 799 97 l 810 3 q 774 -8 799 -2 q 717 -14 749 -14 q 602 30 640 -14 q 564 164 564 75 l 564 642 l 290 642 l 290 0 l 167 0 l 167 642 l 17 642 l 17 691 l 110 745 l 831 745 l 831 642 l 688 642 l 688 173 q 703 107 688 125 q 749 88 719 88 "},"9":{"x_min":72,"x_max":697,"ha":765,"o":"m 697 568 q 689 426 697 497 q 664 290 682 355 q 615 170 646 226 q 536 73 584 114 q 421 9 488 32 q 263 -14 354 -14 q 235 -13 250 -14 q 204 -11 219 -12 q 173 -7 188 -9 q 147 -2 158 -5 l 147 99 q 200 87 171 91 q 259 82 230 82 q 410 115 351 82 q 504 203 469 147 q 553 332 538 258 q 571 486 568 405 l 562 486 q 530 440 549 461 q 485 404 511 419 q 426 379 459 388 q 354 371 394 371 q 237 391 289 371 q 148 449 185 411 q 92 544 112 488 q 72 672 72 600 q 93 811 72 749 q 153 916 114 873 q 248 982 192 959 q 373 1006 304 1006 q 501 979 442 1006 q 603 898 560 953 q 671 762 646 844 q 697 568 697 679 m 374 900 q 300 887 334 900 q 242 845 266 873 q 204 773 217 816 q 191 671 191 730 q 202 586 191 624 q 236 522 213 549 q 292 482 258 496 q 370 467 326 467 q 454 483 417 467 q 518 525 491 499 q 559 583 545 550 q 574 648 574 615 q 561 738 574 693 q 524 819 549 783 q 462 878 499 856 q 374 900 424 900 "},"l":{"x_min":118,"x_max":241.4375,"ha":359,"o":"m 241 0 l 118 0 l 118 1055 l 241 1055 l 241 0 "},"Ъ":{"x_min":14,"x_max":839,"ha":910,"o":"m 839 290 q 818 170 839 224 q 755 79 798 117 q 647 20 712 41 q 490 0 581 0 l 244 0 l 244 880 l 14 880 l 14 992 l 370 992 l 370 574 l 471 574 q 645 551 574 574 q 758 490 715 529 q 820 400 801 452 q 839 290 839 349 m 370 107 l 478 107 q 650 152 595 107 q 705 290 705 197 q 690 370 705 337 q 644 424 675 403 q 566 453 612 444 q 457 462 519 462 l 370 462 l 370 107 "}," ":{"x_min":0,"x_max":0,"ha":139},"Ś":{"x_min":70.109375,"x_max":657,"ha":721,"o":"m 657 264 q 633 147 657 199 q 566 59 610 95 q 460 4 523 23 q 320 -14 398 -14 q 179 -2 245 -14 q 70 32 114 9 l 70 153 q 122 131 93 142 q 184 112 151 120 q 251 99 216 104 q 319 93 285 93 q 479 134 427 93 q 530 252 530 176 q 521 316 530 289 q 486 366 511 343 q 420 410 461 389 q 316 456 379 431 q 212 508 256 480 q 139 572 168 537 q 96 652 110 607 q 83 754 83 697 q 104 860 83 813 q 165 939 126 907 q 259 989 205 972 q 380 1006 314 1006 q 525 990 460 1006 q 640 951 589 975 l 595 845 q 495 880 551 865 q 381 894 440 894 q 254 856 299 894 q 209 752 209 818 q 219 686 209 714 q 252 635 229 657 q 315 592 276 612 q 410 549 353 572 q 517 499 471 525 q 594 441 563 473 q 641 366 625 408 q 657 264 657 323 m 306 1089 q 336 1134 320 1108 q 368 1187 352 1160 q 399 1242 384 1215 q 424 1293 413 1269 l 573 1293 l 573 1278 q 540 1233 562 1260 q 493 1175 519 1205 q 439 1118 467 1146 q 388 1071 411 1089 l 306 1071 l 306 1089 "},"Ü":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 293 1174 q 311 1227 293 1211 q 358 1244 330 1244 q 404 1227 384 1244 q 423 1174 423 1210 q 404 1121 423 1138 q 358 1105 384 1105 q 311 1121 330 1105 q 293 1174 293 1138 m 547 1174 q 566 1227 547 1211 q 612 1244 585 1244 q 637 1239 625 1244 q 658 1227 649 1235 q 672 1206 667 1218 q 678 1174 678 1193 q 658 1121 678 1138 q 612 1105 638 1105 q 566 1121 585 1105 q 547 1174 547 1138 "},"à":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 460 842 l 378 842 q 326 889 354 860 q 272 946 298 917 q 225 1004 246 976 q 193 1049 203 1031 l 193 1064 l 341 1064 q 367 1013 352 1040 q 397 958 381 986 q 429 905 413 931 q 460 860 445 879 l 460 842 "},"η":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 -334 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 -334 l 583 -334 "},"ó":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 321 860 q 351 905 335 879 q 383 958 367 931 q 414 1013 399 986 q 439 1064 428 1040 l 588 1064 l 588 1049 q 555 1004 577 1031 q 508 946 534 976 q 454 889 482 917 q 403 842 426 860 l 321 842 l 321 860 "},"¦":{"x_min":332,"x_max":433.734375,"ha":765,"o":"m 332 1055 l 433 1055 l 433 526 l 332 526 l 332 1055 m 332 196 l 433 196 l 433 -334 l 332 -334 l 332 196 "},"Ő":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 312 1089 q 342 1134 326 1108 q 374 1187 358 1160 q 404 1242 390 1215 q 430 1293 419 1269 l 565 1293 l 565 1278 q 532 1233 554 1260 q 485 1175 511 1205 q 431 1118 459 1146 q 380 1071 404 1089 l 312 1071 l 312 1089 m 558 1089 q 588 1134 572 1108 q 620 1187 604 1160 q 650 1242 636 1215 q 675 1293 665 1269 l 810 1293 l 810 1278 q 777 1233 799 1260 q 730 1175 756 1205 q 676 1118 704 1146 q 625 1071 649 1089 l 558 1071 l 558 1089 "},"Ž":{"x_min":56,"x_max":693,"ha":749,"o":"m 693 0 l 56 0 l 56 97 l 537 880 l 70 880 l 70 992 l 679 992 l 679 894 l 197 111 l 693 111 l 693 0 m 604 1274 q 563 1229 587 1255 q 517 1176 540 1203 q 474 1121 494 1148 q 444 1071 454 1094 l 313 1071 q 283 1121 303 1094 q 240 1176 263 1148 q 194 1229 217 1203 q 154 1274 171 1255 l 154 1293 l 236 1293 q 306 1237 270 1270 q 379 1166 342 1204 q 450 1237 414 1204 q 522 1293 487 1270 l 604 1293 l 604 1274 "},"е":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 "},"Î":{"x_min":12,"x_max":462,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 462 1071 l 380 1071 q 308 1126 345 1093 q 237 1196 272 1159 q 164 1126 200 1159 q 94 1071 128 1093 l 12 1071 l 12 1089 q 52 1134 29 1108 q 98 1187 75 1160 q 141 1242 121 1215 q 171 1293 161 1269 l 302 1293 q 332 1242 312 1269 q 375 1187 352 1215 q 421 1134 398 1160 q 462 1089 445 1108 l 462 1071 "},"e":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 "},"ό":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 352 860 q 365 906 358 880 q 378 960 372 932 q 390 1014 385 987 q 399 1064 396 1041 l 534 1064 l 534 1049 q 518 1007 529 1033 q 492 951 507 980 q 459 892 476 921 q 425 842 441 863 l 352 842 l 352 860 "},"Ĕ":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 601 1259 q 583 1183 598 1217 q 542 1123 568 1149 q 479 1084 516 1098 q 394 1071 442 1071 q 307 1084 344 1071 q 246 1122 270 1097 q 208 1181 221 1147 q 193 1259 195 1216 l 267 1259 q 279 1212 270 1229 q 305 1186 289 1194 q 344 1175 321 1177 q 397 1172 367 1172 q 443 1175 421 1172 q 483 1188 465 1178 q 512 1214 500 1197 q 526 1259 523 1231 l 601 1259 "},"ļ":{"x_min":69,"x_max":248,"ha":359,"o":"m 241 0 l 118 0 l 118 1055 l 241 1055 l 241 0 m 69 -288 q 85 -246 76 -271 q 102 -191 94 -220 q 116 -135 110 -163 q 125 -85 123 -107 l 248 -85 l 248 -98 q 233 -141 243 -115 q 207 -197 222 -167 q 173 -255 192 -226 q 135 -307 155 -284 l 69 -307 l 69 -288 "}," ":{"x_min":0,"x_max":0,"ha":695},"Ѓ":{"x_min":135,"x_max":649,"ha":682,"o":"m 649 992 l 649 880 l 261 880 l 261 0 l 135 0 l 135 992 l 649 992 m 301 1089 q 331 1134 315 1108 q 363 1187 347 1160 q 394 1242 379 1215 q 419 1293 408 1269 l 568 1293 l 568 1278 q 535 1233 557 1260 q 488 1175 514 1205 q 434 1118 462 1146 q 383 1071 406 1089 l 301 1071 l 301 1089 "},"ò":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 507 842 l 425 842 q 373 889 401 860 q 319 946 345 917 q 272 1004 293 976 q 240 1049 250 1031 l 240 1064 l 388 1064 q 414 1013 399 1040 q 444 958 428 986 q 476 905 460 931 q 507 860 492 879 l 507 842 "},"ﬄ":{"x_min":19,"x_max":1155.4375,"ha":1274,"o":"m 441 656 l 274 656 l 274 0 l 151 0 l 151 656 l 19 656 l 19 704 l 151 749 l 151 814 q 166 934 151 886 q 210 1010 181 982 q 280 1051 238 1039 q 375 1063 322 1063 q 449 1055 415 1063 q 509 1037 482 1047 l 477 941 q 431 954 456 949 q 379 960 406 960 q 332 954 352 960 q 300 931 313 947 q 280 887 287 915 q 274 815 274 859 l 274 745 l 441 745 l 441 656 m 898 656 l 731 656 l 731 0 l 608 0 l 608 656 l 476 656 l 476 704 l 608 749 l 608 814 q 623 934 608 886 q 667 1010 638 982 q 737 1051 695 1039 q 832 1063 779 1063 q 906 1055 872 1063 q 966 1037 939 1047 l 934 941 q 888 954 913 949 q 836 960 863 960 q 789 954 809 960 q 757 931 770 947 q 737 887 744 915 q 731 815 731 859 l 731 745 l 898 745 l 898 656 m 1155 0 l 1032 0 l 1032 1055 l 1155 1055 l 1155 0 "},"^":{"x_min":28,"x_max":711,"ha":739,"o":"m 28 372 l 339 999 l 408 999 l 711 372 l 601 372 l 373 870 l 137 372 l 28 372 "},"ⁿ":{"x_min":72,"x_max":446,"ha":515,"o":"m 357 540 l 357 827 q 336 905 357 882 q 274 929 315 929 q 223 921 244 929 q 188 897 202 914 q 167 849 174 879 q 160 775 160 820 l 160 540 l 72 540 l 72 994 l 145 994 l 156 934 l 162 934 q 292 1003 205 1003 q 446 833 446 1003 l 446 540 l 357 540 "},"к":{"x_min":118,"x_max":676.25,"ha":682,"o":"m 516 745 l 649 745 l 369 387 l 676 0 l 536 0 l 241 377 l 241 0 l 118 0 l 118 745 l 241 745 l 241 383 l 516 745 "},"￼":{"x_min":57,"x_max":1346,"ha":1389,"o":"m 57 823 l 57 1030 l 262 1030 l 262 954 l 132 954 l 132 823 l 57 823 m 1139 954 l 1139 1030 l 1346 1030 l 1346 823 l 1272 823 l 1272 954 l 1139 954 m 57 -260 l 57 -54 l 132 -54 l 132 -186 l 262 -186 l 262 -260 l 57 -260 m 1139 -260 l 1139 -186 l 1272 -186 l 1272 -54 l 1346 -54 l 1346 -260 l 1139 -260 m 875 -260 l 875 -186 l 1060 -186 l 1060 -260 l 875 -260 m 345 -260 l 345 -186 l 528 -186 l 528 -260 l 345 -260 m 345 954 l 345 1030 l 528 1030 l 528 954 l 345 954 m 1346 26 l 1272 26 l 1272 210 l 1346 210 l 1346 26 m 1346 558 l 1272 558 l 1272 742 l 1346 742 l 1346 558 m 610 -260 l 610 -186 l 794 -186 l 794 -260 l 610 -260 m 132 26 l 57 26 l 57 210 l 132 210 l 132 26 m 610 954 l 610 1030 l 794 1030 l 794 954 l 610 954 m 875 954 l 875 1030 l 1060 1030 l 1060 954 l 875 954 m 132 291 l 57 291 l 57 476 l 132 476 l 132 291 m 132 558 l 57 558 l 57 742 l 132 742 l 132 558 m 1346 291 l 1272 291 l 1272 476 l 1346 476 l 1346 291 m 408 224 q 276 277 322 224 q 231 427 231 331 q 276 577 231 525 q 408 631 322 630 q 540 578 494 631 q 586 427 586 525 q 540 277 586 331 q 408 224 494 224 m 408 294 q 478 329 457 294 q 499 427 499 364 q 478 525 499 490 q 408 559 457 559 q 339 525 361 559 q 317 427 317 490 q 339 329 317 364 q 408 294 361 294 m 643 626 l 759 626 q 871 603 833 626 q 909 524 909 580 q 893 468 909 491 q 847 439 878 445 l 847 437 q 903 406 886 429 q 921 344 921 383 q 884 259 921 289 q 783 229 847 229 l 643 229 l 643 626 m 726 469 l 770 469 q 814 480 801 469 q 826 513 826 491 q 812 546 826 536 q 766 556 798 556 l 726 556 l 726 469 m 726 402 l 726 298 l 776 298 q 822 312 809 298 q 834 352 834 327 q 821 388 834 374 q 773 402 809 402 l 726 402 m 956 231 l 956 300 q 978 297 967 298 q 1002 295 989 295 q 1044 307 1028 295 q 1061 353 1061 319 l 1061 626 l 1146 626 l 1146 356 q 1110 258 1146 292 q 1011 225 1075 225 q 956 231 969 225 "},"ū":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 214 943 l 604 943 l 604 842 l 214 842 l 214 943 "},"ˆ":{"x_min":175,"x_max":625,"ha":802,"o":"m 625 842 l 543 842 q 471 897 508 864 q 400 967 435 930 q 327 897 363 930 q 257 842 291 864 l 175 842 l 175 860 q 215 905 192 879 q 261 958 238 931 q 304 1013 284 986 q 334 1064 324 1040 l 465 1064 q 495 1013 475 1040 q 538 958 515 986 q 584 905 561 931 q 625 860 608 879 l 625 842 "},"Ẅ":{"x_min":13.75,"x_max":1214.25,"ha":1228,"o":"m 549 992 l 682 992 l 837 411 q 857 335 847 373 q 876 261 867 297 q 891 194 884 225 q 901 136 897 162 q 908 192 904 162 q 917 256 912 223 q 929 325 923 290 q 943 393 936 360 l 1079 992 l 1214 992 l 965 0 l 837 0 l 665 636 q 647 707 656 671 q 631 776 638 744 q 615 848 622 813 q 600 776 608 814 q 585 707 593 745 q 567 632 576 669 l 402 0 l 275 0 l 13 992 l 147 992 l 298 388 q 313 323 306 357 q 325 257 320 290 q 336 192 331 223 q 344 136 341 162 q 352 194 347 161 q 364 264 358 227 q 379 338 371 301 q 396 409 387 376 l 549 992 m 421 1174 q 439 1227 421 1211 q 486 1244 458 1244 q 532 1227 512 1244 q 551 1174 551 1210 q 532 1121 551 1138 q 486 1105 512 1105 q 439 1121 458 1105 q 421 1174 421 1138 m 675 1174 q 694 1227 675 1211 q 740 1244 713 1244 q 765 1239 753 1244 q 786 1227 777 1235 q 800 1206 795 1218 q 806 1174 806 1193 q 786 1121 806 1138 q 740 1105 766 1105 q 694 1121 713 1105 q 675 1174 675 1138 "},"č":{"x_min":77,"x_max":630,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 253 581 302 650 q 204 369 204 513 q 253 160 204 226 q 402 93 302 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 m 630 1045 q 589 1000 613 1026 q 543 947 566 974 q 500 892 520 919 q 470 842 480 865 l 339 842 q 309 892 329 865 q 266 947 289 919 q 220 1000 243 974 q 180 1045 197 1026 l 180 1064 l 262 1064 q 332 1008 296 1041 q 405 937 368 975 q 476 1008 440 975 q 548 1064 513 1041 l 630 1064 l 630 1045 "},"’":{"x_min":16,"x_max":228,"ha":243,"o":"m 219 992 l 228 977 q 205 898 218 939 q 176 815 192 857 q 143 731 160 772 q 108 652 125 690 l 16 652 q 38 737 26 692 q 60 827 49 782 q 79 913 70 871 q 94 992 88 956 l 219 992 "},"Ν":{"x_min":135,"x_max":878,"ha":1013,"o":"m 878 0 l 724 0 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 757 174 l 762 174 q 757 276 759 226 q 755 321 756 298 q 753 366 754 343 q 752 410 752 389 q 751 449 751 431 l 751 992 l 878 992 l 878 0 "},"-":{"x_min":56,"x_max":392,"ha":447,"o":"m 56 315 l 56 429 l 392 429 l 392 315 l 56 315 "},"Q":{"x_min":85,"x_max":945,"ha":1030,"o":"m 945 496 q 928 331 945 407 q 879 193 911 254 q 799 87 847 131 q 687 16 751 42 q 763 -95 717 -47 q 871 -184 810 -144 l 789 -281 q 660 -164 719 -231 q 567 -11 601 -97 q 541 -13 555 -12 q 515 -14 527 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 "},"ј":{"x_min":-46,"x_max":252.96875,"ha":359,"o":"m 44 -334 q -9 -329 12 -334 q -46 -317 -30 -324 l -46 -217 q -10 -227 -28 -224 q 31 -231 8 -231 q 65 -226 50 -231 q 93 -208 81 -221 q 111 -172 105 -194 q 118 -116 118 -150 l 118 745 l 241 745 l 241 -107 q 229 -201 241 -159 q 193 -272 218 -243 q 132 -318 169 -302 q 44 -334 95 -334 m 108 945 q 129 1004 108 986 q 180 1023 149 1023 q 208 1018 195 1023 q 231 1004 221 1014 q 247 980 241 995 q 252 945 252 966 q 231 887 252 906 q 180 868 210 868 q 129 886 149 868 q 108 945 108 905 "},"ě":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 606 1045 q 565 1000 589 1026 q 519 947 542 974 q 476 892 496 919 q 446 842 456 865 l 315 842 q 285 892 305 865 q 242 947 265 919 q 196 1000 219 974 q 156 1045 173 1026 l 156 1064 l 238 1064 q 308 1008 272 1041 q 381 937 344 975 q 452 1008 416 975 q 524 1064 489 1041 l 606 1064 l 606 1045 "},"œ":{"x_min":77,"x_max":1194,"ha":1264,"o":"m 934 -14 q 777 23 846 -14 q 665 135 708 61 q 554 23 622 61 q 400 -14 487 -14 q 271 11 330 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 207 707 q 404 758 328 758 q 553 720 486 758 q 662 610 619 682 q 765 720 702 682 q 906 758 827 758 q 1026 733 973 758 q 1117 665 1079 709 q 1174 560 1154 621 q 1194 423 1194 498 l 1194 346 l 727 346 q 782 155 730 216 q 935 93 833 93 q 999 97 970 93 q 1056 107 1028 100 q 1108 123 1083 113 q 1160 145 1134 133 l 1160 35 q 1107 13 1133 22 q 1054 -2 1081 3 q 997 -11 1027 -8 q 934 -14 968 -14 m 204 373 q 251 159 204 231 q 402 88 297 88 q 552 156 505 88 q 600 366 600 224 q 552 585 600 515 q 401 655 504 655 q 250 585 296 655 q 204 373 204 515 m 1066 449 q 1057 533 1066 495 q 1028 598 1048 571 q 979 640 1009 625 q 906 655 948 655 q 783 602 828 655 q 730 449 737 549 l 1066 449 "},"#":{"x_min":35,"x_max":863,"ha":897,"o":"m 666 606 l 623 382 l 814 382 l 814 290 l 605 290 l 550 0 l 450 0 l 507 290 l 310 290 l 254 0 l 157 0 l 209 290 l 35 290 l 35 382 l 228 382 l 272 606 l 87 606 l 87 699 l 289 699 l 345 992 l 444 992 l 389 699 l 587 699 l 644 992 l 742 992 l 685 699 l 863 699 l 863 606 l 666 606 m 327 382 l 524 382 l 568 606 l 371 606 l 327 382 "},"Џ":{"x_min":135,"x_max":826,"ha":960,"o":"m 826 0 l 546 0 l 546 -261 l 420 -261 l 420 0 l 135 0 l 135 992 l 261 992 l 261 111 l 699 111 l 699 992 l 826 992 l 826 0 "},"Å":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 576 1074 q 564 1012 576 1039 q 531 965 552 984 q 482 936 510 946 q 420 927 453 927 q 358 936 386 927 q 310 965 330 946 q 279 1011 290 984 q 269 1073 269 1038 q 279 1134 269 1107 q 310 1180 290 1161 q 358 1209 330 1199 q 420 1219 386 1219 q 481 1209 453 1219 q 531 1180 510 1199 q 564 1135 552 1161 q 576 1074 576 1108 m 501 1073 q 479 1129 501 1109 q 422 1149 457 1149 q 365 1129 387 1149 q 343 1073 343 1109 q 363 1016 343 1036 q 422 996 383 996 q 479 1016 457 996 q 501 1073 501 1036 "},"ș":{"x_min":61.15625,"x_max":564,"ha":627,"o":"m 564 203 q 544 108 564 149 q 487 40 524 68 q 398 0 450 13 q 281 -14 346 -14 q 154 -2 207 -14 q 61 33 101 9 l 61 146 q 107 125 82 135 q 161 106 133 114 q 219 93 189 98 q 279 88 249 88 q 353 95 323 88 q 403 116 384 103 q 431 150 423 130 q 440 194 440 170 q 433 232 440 215 q 409 265 427 249 q 360 299 391 282 q 280 337 329 316 q 193 378 232 358 q 127 424 154 399 q 86 482 100 449 q 72 560 72 515 q 90 645 72 608 q 143 707 109 682 q 224 745 177 732 q 330 758 272 758 q 451 743 396 758 q 554 706 505 729 l 512 606 q 422 641 468 626 q 329 655 376 655 q 228 632 261 655 q 195 568 195 610 q 203 526 195 544 q 229 493 210 509 q 279 461 248 477 q 358 426 311 445 q 444 385 406 405 q 509 339 482 365 q 549 281 535 314 q 564 203 564 249 m 202 -288 q 218 -246 209 -271 q 235 -191 227 -220 q 249 -135 243 -163 q 258 -85 256 -107 l 381 -85 l 381 -98 q 366 -141 376 -115 q 340 -197 355 -167 q 306 -255 325 -226 q 268 -307 288 -284 l 202 -307 l 202 -288 "},"¸":{"x_min":24,"x_max":277,"ha":285,"o":"m 277 -194 q 229 -297 277 -260 q 79 -334 181 -334 q 49 -331 64 -334 q 24 -327 34 -329 l 24 -254 q 50 -257 34 -256 q 77 -258 67 -258 q 152 -247 125 -258 q 179 -208 179 -235 q 170 -186 179 -195 q 146 -169 161 -176 q 109 -157 131 -162 q 64 -147 88 -152 l 125 0 l 207 0 l 168 -78 q 211 -92 191 -83 q 245 -115 230 -101 q 268 -148 260 -128 q 277 -194 277 -168 "},"=":{"x_min":69,"x_max":696,"ha":765,"o":"m 69 577 l 69 679 l 696 679 l 696 577 l 69 577 m 69 300 l 69 402 l 696 402 l 696 300 l 69 300 "},"ρ":{"x_min":111,"x_max":725,"ha":802,"o":"m 725 373 q 703 208 725 280 q 642 86 682 135 q 546 11 602 37 q 418 -14 489 -14 q 319 1 368 -14 q 234 47 271 16 l 230 47 q 232 -13 231 17 q 234 -72 233 -39 q 234 -136 234 -105 l 234 -334 l 111 -334 l 111 373 q 133 537 111 465 q 195 657 155 608 q 293 732 236 707 q 422 758 351 758 q 543 732 488 758 q 639 657 598 707 q 702 537 679 608 q 725 373 725 465 m 417 655 q 280 589 324 655 q 234 386 236 522 l 234 156 q 319 105 271 121 q 419 88 368 88 q 555 159 514 88 q 597 373 597 231 q 555 585 597 515 q 417 655 512 655 "},"Ћ":{"x_min":13,"x_max":873,"ha":977,"o":"m 370 609 l 605 609 q 718 592 668 609 q 802 543 768 575 q 854 464 836 511 q 873 357 873 417 l 873 0 l 746 0 l 746 340 q 711 458 746 419 q 591 497 675 497 l 370 497 l 370 0 l 244 0 l 244 880 l 13 880 l 13 992 l 654 992 l 654 880 l 370 880 l 370 609 "},"ú":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 331 860 q 361 905 345 879 q 393 958 377 931 q 424 1013 409 986 q 449 1064 438 1040 l 598 1064 l 598 1049 q 565 1004 587 1031 q 518 946 544 976 q 464 889 492 917 q 413 842 436 860 l 331 842 l 331 860 "},"˚":{"x_min":248,"x_max":555,"ha":802,"o":"m 555 989 q 543 927 555 954 q 510 880 531 899 q 461 851 489 861 q 399 842 432 842 q 337 851 365 842 q 289 880 309 861 q 258 926 269 899 q 248 988 248 953 q 258 1049 248 1022 q 289 1095 269 1076 q 337 1124 309 1114 q 399 1134 365 1134 q 460 1124 432 1134 q 510 1095 489 1114 q 543 1050 531 1076 q 555 989 555 1023 m 480 988 q 458 1044 480 1024 q 401 1064 436 1064 q 344 1044 366 1064 q 322 988 322 1024 q 342 931 322 951 q 401 911 362 911 q 458 931 436 911 q 480 988 480 951 "},"д":{"x_min":28,"x_max":732,"ha":760,"o":"m 732 -258 l 615 -258 l 615 0 l 144 0 l 144 -258 l 28 -258 l 28 102 l 85 102 q 163 242 130 167 q 220 401 197 318 q 254 571 243 484 q 267 745 266 658 l 630 745 l 630 102 l 732 102 l 732 -258 m 506 102 l 506 656 l 383 656 q 365 511 378 585 q 332 365 352 437 q 282 226 311 293 q 215 102 253 159 l 506 102 "},"¯":{"x_min":-4,"x_max":699,"ha":695,"o":"m 699 1055 l -4 1055 l -4 1150 l 699 1150 l 699 1055 "},"u":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 "},"З":{"x_min":49,"x_max":681,"ha":757,"o":"m 663 759 q 645 668 663 709 q 597 598 628 628 q 524 548 566 568 q 431 521 481 529 l 431 517 q 536 490 489 509 q 615 441 583 471 q 664 370 647 410 q 681 281 681 330 q 658 162 681 216 q 589 68 635 108 q 473 7 543 29 q 311 -14 404 -14 q 171 -2 236 -14 q 49 39 106 9 l 49 154 q 110 128 78 140 q 176 109 143 117 q 243 97 209 102 q 308 93 276 93 q 487 142 428 93 q 547 281 547 192 q 477 414 547 371 q 281 457 407 457 l 153 457 l 153 565 l 271 565 q 382 578 334 565 q 462 615 430 591 q 512 673 495 639 q 529 747 529 706 q 516 811 529 783 q 481 858 504 839 q 426 888 458 878 q 354 898 394 898 q 223 876 280 898 q 115 819 166 854 l 53 904 q 112 943 78 925 q 184 975 145 961 q 268 997 223 989 q 361 1006 312 1006 q 491 987 435 1006 q 585 936 547 969 q 643 858 624 903 q 663 759 663 812 "},"Α":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 "},"⅝":{"x_min":54,"x_max":1011,"ha":1051,"o":"m 232 769 q 310 757 274 769 q 373 722 346 745 q 415 664 400 699 q 431 586 431 630 q 374 438 431 491 q 208 385 318 385 q 124 394 166 385 q 54 422 83 404 l 54 518 q 92 497 71 506 q 133 481 112 488 q 174 471 154 475 q 211 468 194 468 q 301 493 269 468 q 334 577 334 519 q 301 657 334 628 q 208 685 269 685 q 186 684 199 685 q 160 680 174 682 q 134 676 147 678 q 112 672 122 674 l 67 702 l 89 992 l 389 992 l 389 908 l 170 908 l 158 762 q 191 766 172 764 q 232 769 210 769 m 860 992 l 309 0 l 202 0 l 753 992 l 860 992 m 815 604 q 883 594 851 604 q 938 567 914 585 q 976 519 962 548 q 991 453 991 491 q 983 407 991 428 q 962 369 976 386 q 931 338 949 352 q 893 313 914 325 q 938 285 917 300 q 975 251 959 270 q 1001 209 991 233 q 1011 157 1011 186 q 996 87 1011 119 q 956 33 982 56 q 894 0 930 11 q 816 -13 858 -13 q 670 31 721 -13 q 620 153 620 75 q 628 205 620 182 q 651 247 636 228 q 684 281 665 266 q 724 307 703 295 q 690 335 705 321 q 662 368 674 350 q 644 407 650 386 q 638 453 638 428 q 652 519 638 491 q 691 566 667 547 q 748 594 716 585 q 815 604 780 604 m 716 155 q 741 93 716 116 q 814 70 766 70 q 888 93 863 70 q 914 155 914 116 q 906 190 914 174 q 885 219 899 206 q 854 242 872 232 q 813 262 835 253 l 802 266 q 738 219 760 244 q 716 155 716 193 m 813 520 q 755 502 776 520 q 734 449 734 484 q 741 417 734 431 q 757 392 747 404 q 783 371 768 380 q 815 353 798 361 q 846 370 831 360 q 871 390 860 379 q 887 416 881 402 q 894 449 894 430 q 872 502 894 484 q 813 520 850 520 "},"é":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 322 860 q 352 905 336 879 q 384 958 368 931 q 415 1013 400 986 q 440 1064 429 1040 l 589 1064 l 589 1049 q 556 1004 578 1031 q 509 946 535 976 q 455 889 483 917 q 404 842 427 860 l 322 842 l 322 860 "},"Ş":{"x_min":70.109375,"x_max":657,"ha":721,"o":"m 657 264 q 633 147 657 199 q 566 59 610 95 q 460 4 523 23 q 320 -14 398 -14 q 179 -2 245 -14 q 70 32 114 9 l 70 153 q 122 131 93 142 q 184 112 151 120 q 251 99 216 104 q 319 93 285 93 q 479 134 427 93 q 530 252 530 176 q 521 316 530 289 q 486 366 511 343 q 420 410 461 389 q 316 456 379 431 q 212 508 256 480 q 139 572 168 537 q 96 652 110 607 q 83 754 83 697 q 104 860 83 813 q 165 939 126 907 q 259 989 205 972 q 380 1006 314 1006 q 525 990 460 1006 q 640 951 589 975 l 595 845 q 495 880 551 865 q 381 894 440 894 q 254 856 299 894 q 209 752 209 818 q 219 686 209 714 q 252 635 229 657 q 315 592 276 612 q 410 549 353 572 q 517 499 471 525 q 594 441 563 473 q 641 366 625 408 q 657 264 657 323 m 486 -194 q 438 -297 486 -260 q 288 -334 390 -334 q 258 -331 273 -334 q 233 -327 243 -329 l 233 -254 q 259 -257 243 -256 q 286 -258 276 -258 q 361 -247 334 -258 q 388 -208 388 -235 q 379 -186 388 -195 q 355 -169 370 -176 q 318 -157 340 -162 q 273 -147 297 -152 l 334 0 l 416 0 l 377 -78 q 420 -92 400 -83 q 454 -115 439 -101 q 477 -148 469 -128 q 486 -194 486 -168 "},"B":{"x_min":135,"x_max":786,"ha":863,"o":"m 135 992 l 405 992 q 558 978 492 992 q 668 936 624 965 q 735 858 713 906 q 758 740 758 810 q 744 662 758 698 q 707 597 731 625 q 645 551 682 569 q 563 526 609 532 l 563 519 q 650 496 609 511 q 720 454 690 480 q 768 386 751 427 q 786 287 786 345 q 763 166 786 219 q 700 76 741 113 q 598 19 658 39 q 463 0 539 0 l 135 0 l 135 992 m 261 572 l 427 572 q 523 582 485 572 q 586 612 562 592 q 621 662 610 632 q 631 732 631 692 q 579 848 631 813 q 413 884 526 884 l 261 884 l 261 572 m 261 464 l 261 107 l 441 107 q 541 121 500 107 q 606 159 581 134 q 641 217 630 183 q 652 292 652 251 q 641 362 652 330 q 604 416 630 393 q 537 451 579 439 q 433 464 495 464 l 261 464 "},"…":{"x_min":100,"x_max":1017,"ha":1117,"o":"m 100 74 q 106 118 100 100 q 125 147 113 136 q 152 163 136 158 q 186 169 167 169 q 219 163 203 169 q 246 147 235 158 q 265 118 258 136 q 272 74 272 100 q 265 31 272 49 q 246 2 258 13 q 219 -14 235 -9 q 186 -20 203 -20 q 152 -14 167 -20 q 125 2 136 -9 q 106 31 113 13 q 100 74 100 49 m 473 74 q 479 118 473 100 q 498 147 486 136 q 525 163 509 158 q 559 169 540 169 q 592 163 576 169 q 619 147 608 158 q 638 118 631 136 q 645 74 645 100 q 638 31 645 49 q 619 2 631 13 q 592 -14 608 -9 q 559 -20 576 -20 q 525 -14 540 -20 q 498 2 509 -9 q 479 31 486 13 q 473 74 473 49 m 845 74 q 851 118 845 100 q 869 147 857 136 q 897 163 881 158 q 931 169 912 169 q 964 163 948 169 q 991 147 980 158 q 1010 118 1003 136 q 1017 74 1017 100 q 1010 31 1017 49 q 991 2 1003 13 q 964 -14 980 -9 q 931 -20 948 -20 q 869 2 894 -20 q 845 74 845 24 "},"H":{"x_min":135,"x_max":839,"ha":974,"o":"m 839 0 l 712 0 l 712 462 l 261 462 l 261 0 l 135 0 l 135 992 l 261 992 l 261 574 l 712 574 l 712 992 l 839 992 l 839 0 "},"î":{"x_min":-45,"x_max":405,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 405 842 l 323 842 q 251 897 288 864 q 180 967 215 930 q 107 897 143 930 q 37 842 71 864 l -45 842 l -45 860 q -4 905 -27 879 q 41 958 18 931 q 84 1013 64 986 q 114 1064 104 1040 l 245 1064 q 275 1013 255 1040 q 318 958 295 986 q 364 905 341 931 q 405 860 388 879 l 405 842 "},"ν":{"x_min":-0.25,"x_max":661,"ha":718,"o":"m 0 745 l 127 745 l 263 343 q 282 287 271 320 q 302 218 292 253 q 321 152 313 183 q 333 104 330 121 l 337 104 q 437 239 398 169 q 498 387 475 308 q 529 553 520 465 q 537 745 537 642 l 661 745 q 648 536 661 634 q 604 348 635 439 q 521 172 573 257 q 389 0 469 86 l 259 0 l 0 745 "},"Ό":{"x_min":-16,"x_max":1001,"ha":1087,"o":"m 1001 496 q 973 287 1001 382 q 891 126 946 193 q 757 22 837 59 q 571 -14 676 -14 q 380 22 461 -14 q 245 126 299 59 q 166 288 192 193 q 141 498 141 382 q 166 707 141 613 q 246 867 192 801 q 381 970 299 934 q 573 1007 462 1007 q 757 970 678 1007 q 891 867 837 934 q 973 706 946 800 q 1001 496 1001 612 m 274 497 q 292 330 274 404 q 346 204 309 255 q 438 124 382 152 q 571 97 494 97 q 704 124 649 97 q 797 204 760 152 q 850 330 833 255 q 867 497 867 404 q 850 664 867 590 q 797 789 833 738 q 705 868 761 840 q 573 895 650 895 q 439 868 495 895 q 346 789 383 840 q 292 664 309 738 q 274 497 274 590 m -16 789 q -2 835 -9 809 q 10 889 4 861 q 22 943 17 916 q 31 993 28 970 l 166 993 l 166 978 q 150 936 161 962 q 124 880 139 909 q 91 821 108 850 q 57 771 73 792 l -16 771 l -16 789 "},"−":{"x_min":69,"x_max":696,"ha":765,"o":"m 69 439 l 69 541 l 696 541 l 696 439 l 69 439 "},"⅜":{"x_min":35,"x_max":1011,"ha":1051,"o":"m 414 852 q 386 764 414 800 q 312 712 359 729 q 402 660 372 697 q 432 571 432 624 q 418 496 432 530 q 376 437 404 461 q 305 399 348 413 q 204 386 263 386 q 115 394 157 386 q 35 423 73 402 l 35 514 q 124 481 78 493 q 206 469 169 469 q 304 497 274 469 q 335 575 335 525 q 297 648 335 625 q 193 671 260 671 l 125 671 l 125 745 l 193 745 q 287 771 258 745 q 317 839 317 797 q 310 876 317 860 q 291 901 303 891 q 262 915 278 911 q 227 920 246 920 q 152 907 186 920 q 83 870 119 894 l 36 935 q 76 963 55 951 q 120 985 97 976 q 169 998 143 993 q 224 1004 194 1004 q 307 992 271 1004 q 366 961 342 981 q 402 913 390 940 q 414 852 414 885 m 860 992 l 309 0 l 202 0 l 753 992 l 860 992 m 815 604 q 883 594 851 604 q 938 567 914 585 q 976 519 962 548 q 991 453 991 491 q 983 407 991 428 q 962 369 976 386 q 931 338 949 352 q 893 313 914 325 q 938 285 917 300 q 975 251 959 270 q 1001 209 991 233 q 1011 157 1011 186 q 996 87 1011 119 q 956 33 982 56 q 894 0 930 11 q 816 -13 858 -13 q 670 31 721 -13 q 620 153 620 75 q 628 205 620 182 q 651 247 636 228 q 684 281 665 266 q 724 307 703 295 q 690 335 705 321 q 662 368 674 350 q 644 407 650 386 q 638 453 638 428 q 652 519 638 491 q 691 566 667 547 q 748 594 716 585 q 815 604 780 604 m 716 155 q 741 93 716 116 q 814 70 766 70 q 888 93 863 70 q 914 155 914 116 q 906 190 914 174 q 885 219 899 206 q 854 242 872 232 q 813 262 835 253 l 802 266 q 738 219 760 244 q 716 155 716 193 m 813 520 q 755 502 776 520 q 734 449 734 484 q 741 417 734 431 q 757 392 747 404 q 783 371 768 380 q 815 353 798 361 q 846 370 831 360 q 871 390 860 379 q 887 416 881 402 q 894 449 894 430 q 872 502 894 484 q 813 520 850 520 "},"ǰ":{"x_min":-46,"x_max":405,"ha":359,"o":"m 44 -334 q -9 -329 12 -334 q -46 -317 -30 -324 l -46 -217 q -10 -227 -28 -224 q 31 -231 8 -231 q 65 -226 50 -231 q 93 -208 81 -221 q 111 -172 105 -194 q 118 -116 118 -150 l 118 745 l 241 745 l 241 -107 q 229 -201 241 -159 q 193 -272 218 -243 q 132 -318 169 -302 q 44 -334 95 -334 m 405 1045 q 364 1000 388 1026 q 318 947 341 974 q 275 892 295 919 q 245 842 255 865 l 114 842 q 84 892 104 865 q 41 947 64 919 q -4 1000 18 974 q -45 1045 -27 1026 l -45 1064 l 37 1064 q 107 1008 71 1041 q 180 937 143 975 q 251 1008 215 975 q 323 1064 288 1041 l 405 1064 l 405 1045 "},"ā":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 174 943 l 564 943 l 564 842 l 174 842 l 174 943 "},"ĵ":{"x_min":-46,"x_max":405,"ha":359,"o":"m 44 -334 q -9 -329 12 -334 q -46 -317 -30 -324 l -46 -217 q -10 -227 -28 -224 q 31 -231 8 -231 q 65 -226 50 -231 q 93 -208 81 -221 q 111 -172 105 -194 q 118 -116 118 -150 l 118 745 l 241 745 l 241 -107 q 229 -201 241 -159 q 193 -272 218 -243 q 132 -318 169 -302 q 44 -334 95 -334 m 405 842 l 323 842 q 251 897 288 864 q 180 967 215 930 q 107 897 143 930 q 37 842 71 864 l -45 842 l -45 860 q -4 905 -27 879 q 41 958 18 931 q 84 1013 64 986 q 114 1064 104 1040 l 245 1064 q 275 1013 255 1040 q 318 958 295 986 q 364 905 341 931 q 405 860 388 879 l 405 842 "},"Ĩ":{"x_min":-8,"x_max":480,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 336 1072 q 282 1083 309 1072 q 230 1110 256 1095 q 180 1136 204 1124 q 135 1148 156 1148 q 88 1130 104 1148 q 62 1070 72 1112 l -8 1070 q 6 1144 -4 1111 q 35 1201 17 1177 q 78 1237 53 1224 q 135 1250 103 1250 q 191 1238 163 1250 q 244 1211 218 1226 q 293 1185 270 1197 q 336 1173 317 1173 q 382 1191 367 1173 q 408 1251 398 1209 l 480 1251 q 465 1177 476 1210 q 436 1121 454 1144 q 393 1084 418 1097 q 336 1072 368 1072 "},"*":{"x_min":55.3125,"x_max":707.71875,"ha":765,"o":"m 450 1055 l 420 788 l 690 863 l 707 733 l 451 714 l 617 493 l 496 428 l 377 670 l 270 428 l 145 493 l 309 714 l 55 733 l 74 863 l 340 788 l 311 1055 l 450 1055 "},"ă":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 574 1030 q 556 954 571 988 q 515 894 541 920 q 452 855 489 869 q 367 842 415 842 q 280 855 317 842 q 219 893 243 868 q 181 952 194 918 q 166 1030 168 987 l 240 1030 q 252 983 243 1000 q 278 957 262 965 q 317 946 294 948 q 370 943 340 943 q 416 946 394 943 q 456 959 438 949 q 485 985 473 968 q 499 1030 496 1002 l 574 1030 "},"Χ":{"x_min":-0.25,"x_max":760.25,"ha":760,"o":"m 760 0 l 617 0 l 376 430 l 127 0 l 0 0 l 307 518 l 20 992 l 155 992 l 380 612 l 608 992 l 737 992 l 450 522 l 760 0 "},"†":{"x_min":83,"x_max":591.171875,"ha":675,"o":"m 591 670 l 366 691 l 404 0 l 257 0 l 294 691 l 83 670 l 83 793 l 294 772 l 257 1055 l 404 1055 l 366 772 l 591 793 l 591 670 "},"°":{"x_min":83,"x_max":512,"ha":595,"o":"m 83 791 q 100 874 83 835 q 145 942 117 913 q 213 989 174 972 q 297 1006 252 1006 q 380 989 341 1006 q 448 942 419 972 q 495 874 478 913 q 512 791 512 835 q 495 708 512 747 q 448 641 478 669 q 380 595 419 612 q 297 579 341 579 q 213 595 252 579 q 145 641 174 612 q 100 708 117 669 q 83 791 83 747 m 184 790 q 193 744 184 766 q 218 707 203 723 q 256 681 234 690 q 301 671 277 671 q 347 681 326 671 q 385 707 369 690 q 410 744 401 723 q 419 790 419 766 q 410 838 419 815 q 385 877 401 860 q 347 903 369 893 q 301 913 326 913 q 256 903 277 913 q 218 877 234 893 q 193 838 203 860 q 184 790 184 815 "},"Ξ":{"x_min":56,"x_max":682,"ha":737,"o":"m 139 574 l 599 574 l 599 462 l 139 462 l 139 574 m 84 992 l 654 992 l 654 880 l 84 880 l 84 992 m 682 111 l 682 0 l 56 0 l 56 111 l 682 111 "},"Ķ":{"x_min":135,"x_max":804.25,"ha":804,"o":"m 804 0 l 661 0 l 355 473 l 261 396 l 261 0 l 135 0 l 135 992 l 261 992 l 261 496 l 343 609 l 649 992 l 791 992 l 438 559 l 804 0 m 327 -288 q 343 -246 334 -271 q 360 -191 352 -220 q 374 -135 368 -163 q 383 -85 381 -107 l 506 -85 l 506 -98 q 491 -141 501 -115 q 465 -197 480 -167 q 431 -255 450 -226 q 393 -307 413 -284 l 327 -307 l 327 -288 "},"ŵ":{"x_min":13.75,"x_max":1022.25,"ha":1036,"o":"m 683 0 l 570 417 q 563 445 567 430 q 555 477 559 460 q 546 512 551 494 q 538 546 542 529 q 518 628 528 586 l 514 628 q 496 546 505 585 q 480 476 488 512 q 464 415 471 440 l 347 0 l 204 0 l 13 745 l 143 745 l 232 348 q 245 282 239 318 q 258 211 252 246 q 269 146 264 177 q 277 95 274 115 l 281 95 q 290 142 284 113 q 303 205 296 172 q 317 270 310 238 q 331 324 325 302 l 453 745 l 586 745 l 702 324 q 716 270 709 301 q 732 207 724 239 q 745 145 739 175 q 754 95 751 115 l 758 95 q 764 142 760 113 q 775 207 769 172 q 788 279 781 242 q 803 348 795 316 l 896 745 l 1022 745 l 829 0 l 683 0 m 743 842 l 661 842 q 589 897 626 864 q 518 967 553 930 q 445 897 481 930 q 375 842 409 864 l 293 842 l 293 860 q 333 905 310 879 q 379 958 356 931 q 422 1013 402 986 q 452 1064 442 1040 l 583 1064 q 613 1013 593 1040 q 656 958 633 986 q 702 905 679 931 q 743 860 726 879 l 743 842 "},"΄":{"x_min":342,"x_max":524,"ha":802,"o":"m 342 860 q 355 906 348 880 q 368 960 362 932 q 380 1014 375 987 q 389 1064 386 1041 l 524 1064 l 524 1049 q 508 1007 519 1033 q 482 951 497 980 q 449 892 466 921 q 415 842 431 863 l 342 842 l 342 860 "},"ǽ":{"x_min":64,"x_max":1088,"ha":1157,"o":"m 64 208 q 142 379 64 320 q 382 445 221 439 l 508 450 l 508 496 q 498 572 508 541 q 469 620 488 602 q 423 647 450 639 q 360 655 395 655 q 254 639 303 655 q 160 599 205 623 l 117 692 q 229 739 167 720 q 359 758 291 758 q 505 729 448 758 q 591 637 562 700 q 681 726 625 694 q 807 758 737 758 q 924 733 872 758 q 1013 665 976 709 q 1068 560 1049 622 q 1088 424 1088 499 l 1088 347 l 634 347 q 687 157 637 218 q 836 96 737 96 q 897 99 869 96 q 952 109 926 103 q 1004 126 979 116 q 1054 148 1029 135 l 1054 36 q 1002 13 1027 23 q 950 -2 977 4 q 895 -11 923 -8 q 833 -14 866 -14 q 672 24 740 -14 q 562 141 604 63 q 513 75 539 104 q 454 27 487 47 q 383 -3 422 7 q 293 -14 343 -14 q 202 0 244 -14 q 130 40 160 12 q 81 109 99 67 q 64 208 64 151 m 191 207 q 224 117 191 146 q 312 88 258 88 q 389 101 354 88 q 451 139 425 113 q 492 204 477 165 q 507 296 507 243 l 507 363 l 408 358 q 305 345 347 355 q 238 315 263 334 q 202 269 213 296 q 191 207 191 241 m 807 655 q 688 603 731 655 q 637 450 644 550 l 960 450 q 951 533 960 495 q 923 598 942 572 q 876 640 904 625 q 807 655 847 655 m 519 860 q 549 905 533 879 q 581 958 565 931 q 612 1013 597 986 q 637 1064 626 1040 l 786 1064 l 786 1049 q 753 1004 775 1031 q 706 946 732 976 q 652 889 680 917 q 601 842 624 860 l 519 842 l 519 860 "},"Β":{"x_min":135,"x_max":786,"ha":863,"o":"m 135 992 l 405 992 q 558 978 492 992 q 668 936 624 965 q 735 858 713 906 q 758 740 758 810 q 744 662 758 698 q 707 597 731 625 q 645 551 682 569 q 563 526 609 532 l 563 519 q 650 496 609 511 q 720 454 690 480 q 768 386 751 427 q 786 287 786 345 q 763 166 786 219 q 700 76 741 113 q 598 19 658 39 q 463 0 539 0 l 135 0 l 135 992 m 261 572 l 427 572 q 523 582 485 572 q 586 612 562 592 q 621 662 610 632 q 631 732 631 692 q 579 848 631 813 q 413 884 526 884 l 261 884 l 261 572 m 261 464 l 261 107 l 441 107 q 541 121 500 107 q 606 159 581 134 q 641 217 630 183 q 652 292 652 251 q 641 362 652 330 q 604 416 630 393 q 537 451 579 439 q 433 464 495 464 l 261 464 "},"Ļ":{"x_min":135,"x_max":649.4375,"ha":682,"o":"m 135 0 l 135 992 l 261 992 l 261 111 l 649 111 l 649 0 l 135 0 m 279 -288 q 295 -246 286 -271 q 312 -191 304 -220 q 326 -135 320 -163 q 335 -85 333 -107 l 458 -85 l 458 -98 q 443 -141 453 -115 q 417 -197 432 -167 q 383 -255 402 -226 q 345 -307 365 -284 l 279 -307 l 279 -288 "},"Õ":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 604 1072 q 550 1083 577 1072 q 498 1110 524 1095 q 448 1136 472 1124 q 403 1148 424 1148 q 356 1130 372 1148 q 330 1070 340 1112 l 260 1070 q 274 1144 263 1111 q 303 1201 285 1177 q 346 1237 321 1224 q 403 1250 371 1250 q 459 1238 431 1250 q 512 1211 486 1226 q 561 1185 538 1197 q 604 1173 585 1173 q 650 1191 635 1173 q 676 1251 666 1209 l 748 1251 q 733 1177 744 1210 q 704 1121 722 1144 q 661 1084 686 1097 q 604 1072 636 1072 "},"№":{"x_min":135,"x_max":1308,"ha":1372,"o":"m 807 0 l 653 0 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 686 174 l 690 174 q 685 276 688 226 q 683 321 684 298 q 682 366 682 343 q 681 410 681 389 q 680 449 680 431 l 680 992 l 807 992 l 807 0 m 1308 412 q 1294 309 1308 354 q 1254 234 1280 264 q 1190 187 1227 203 q 1107 171 1153 171 q 1028 187 1064 171 q 966 234 992 203 q 924 309 939 264 q 910 412 910 354 q 923 513 910 469 q 963 588 937 558 q 1027 635 990 619 q 1110 651 1064 651 q 1188 635 1152 651 q 1251 588 1225 619 q 1293 513 1278 558 q 1308 412 1308 469 m 1006 412 q 1031 294 1006 334 q 1109 254 1055 254 q 1187 294 1163 254 q 1211 412 1211 334 q 1187 529 1211 491 q 1109 567 1163 567 q 1031 529 1055 567 q 1006 412 1006 491 m 938 0 l 938 83 l 1275 83 l 1275 0 l 938 0 "},"χ":{"x_min":-14.25,"x_max":720,"ha":728,"o":"m 126 747 q 182 736 157 747 q 226 704 207 725 q 263 652 246 683 q 294 580 279 621 l 377 346 l 573 745 l 694 745 l 424 218 l 544 -107 q 564 -155 554 -132 q 586 -194 574 -177 q 617 -221 599 -211 q 660 -231 635 -231 q 693 -229 677 -231 q 720 -226 709 -228 l 720 -322 q 685 -330 705 -326 q 639 -334 666 -334 q 561 -321 593 -334 q 505 -284 529 -308 q 463 -226 481 -260 q 430 -147 446 -191 l 342 98 l 117 -334 l -14 -334 l 294 228 l 185 530 q 142 614 167 584 q 82 644 118 644 q 39 637 58 644 l 39 735 q 75 743 53 740 q 126 747 96 747 "},"ί":{"x_min":111,"x_max":428,"ha":454,"o":"m 234 743 l 234 220 q 255 121 234 154 q 326 88 277 88 q 353 89 338 88 q 383 93 368 91 q 409 97 397 95 q 428 102 421 100 l 428 8 q 405 0 419 3 q 375 -7 391 -4 q 341 -12 358 -10 q 307 -14 323 -14 q 229 -3 265 -14 q 167 34 193 7 q 125 105 140 60 q 111 219 111 150 l 111 743 l 234 743 m 134 860 q 147 906 140 880 q 160 960 154 932 q 172 1014 167 987 q 181 1064 178 1041 l 316 1064 l 316 1049 q 300 1007 311 1033 q 274 951 289 980 q 241 892 258 921 q 207 842 223 863 l 134 842 l 134 860 "},"Ζ":{"x_min":56,"x_max":693,"ha":749,"o":"m 693 0 l 56 0 l 56 97 l 537 880 l 70 880 l 70 992 l 679 992 l 679 894 l 197 111 l 693 111 l 693 0 "},"Ľ":{"x_min":135,"x_max":649.4375,"ha":682,"o":"m 135 0 l 135 992 l 261 992 l 261 111 l 649 111 l 649 0 l 135 0 m 439 787 q 451 834 445 808 q 463 887 457 860 q 473 942 468 915 q 480 992 478 969 l 603 992 l 603 978 q 588 934 598 961 q 564 879 577 908 q 534 820 550 850 q 504 770 519 791 l 439 770 l 439 787 "},"ť":{"x_min":23,"x_max":505,"ha":471,"o":"m 343 88 q 371 89 355 88 q 400 93 386 91 q 426 97 415 95 q 445 102 438 100 l 445 8 q 422 0 436 3 q 392 -7 409 -4 q 358 -12 376 -10 q 324 -14 341 -14 q 246 -3 282 -14 q 184 34 210 7 q 142 106 157 61 q 128 221 128 152 l 128 656 l 23 656 l 23 709 l 128 759 l 180 915 l 251 915 l 251 745 l 439 745 l 439 656 l 251 656 l 251 221 q 272 121 251 155 q 343 88 294 88 m 341 850 q 353 897 347 871 q 365 950 359 923 q 375 1005 370 978 q 382 1055 380 1032 l 505 1055 l 505 1041 q 490 997 500 1024 q 466 942 479 971 q 436 883 452 913 q 406 833 421 854 l 341 833 l 341 850 "},"5":{"x_min":89,"x_max":688,"ha":765,"o":"m 369 608 q 494 589 436 608 q 596 534 552 570 q 663 443 639 497 q 688 317 688 388 q 664 178 688 240 q 596 74 641 116 q 484 8 550 31 q 330 -14 417 -14 q 262 -10 295 -14 q 197 0 228 -7 q 139 15 167 5 q 89 39 111 26 l 89 156 q 141 128 111 140 q 205 108 172 116 q 272 95 238 99 q 334 91 306 91 q 430 103 388 91 q 501 142 472 116 q 546 208 531 169 q 562 303 562 248 q 502 451 562 400 q 328 502 442 502 q 288 501 310 502 q 245 496 267 499 q 204 491 224 494 q 171 485 185 487 l 110 523 l 147 992 l 615 992 l 615 879 l 254 879 l 228 594 q 285 603 249 598 q 369 608 320 608 "},"o":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 "},"Ѕ":{"x_min":70.109375,"x_max":657,"ha":721,"o":"m 657 264 q 633 147 657 199 q 566 59 610 95 q 460 4 523 23 q 320 -14 398 -14 q 179 -2 245 -14 q 70 32 114 9 l 70 153 q 122 131 93 142 q 184 112 151 120 q 251 99 216 104 q 319 93 285 93 q 479 134 427 93 q 530 252 530 176 q 521 316 530 289 q 486 366 511 343 q 420 410 461 389 q 316 456 379 431 q 212 508 256 480 q 139 572 168 537 q 96 652 110 607 q 83 754 83 697 q 104 860 83 813 q 165 939 126 907 q 259 989 205 972 q 380 1006 314 1006 q 525 990 460 1006 q 640 951 589 975 l 595 845 q 495 880 551 865 q 381 894 440 894 q 254 856 299 894 q 209 752 209 818 q 219 686 209 714 q 252 635 229 657 q 315 592 276 612 q 410 549 353 572 q 517 499 471 525 q 594 441 563 473 q 641 366 625 408 q 657 264 657 323 "},"�":{"x_min":57.328125,"x_max":1331.03125,"ha":1389,"o":"m 693 1055 l 1331 419 l 693 -216 l 57 419 l 693 1055 m 737 249 l 737 280 q 748 331 737 310 q 811 392 759 352 q 904 488 878 443 q 931 592 931 532 q 914 676 931 639 q 866 737 897 712 q 791 775 835 762 q 692 789 747 789 q 632 783 662 789 q 572 769 601 778 q 514 747 542 759 q 464 722 487 736 l 519 601 q 608 640 565 624 q 689 656 651 656 q 753 636 732 656 q 774 584 774 616 q 761 528 774 551 q 692 461 747 505 q 620 384 645 425 q 595 289 595 343 l 595 249 l 737 249 m 577 62 q 601 -4 577 20 q 672 -29 625 -29 q 742 -4 718 -29 q 767 62 767 20 q 742 130 767 105 q 672 155 718 155 q 601 130 625 155 q 577 62 577 105 "},"d":{"x_min":77,"x_max":696,"ha":814,"o":"m 577 99 l 572 99 q 537 55 557 76 q 491 19 517 34 q 432 -5 465 3 q 359 -14 400 -14 q 244 10 296 -14 q 154 83 192 34 q 97 203 117 131 q 77 370 77 275 q 97 538 77 466 q 154 659 117 610 q 244 733 192 708 q 359 758 296 758 q 432 749 399 758 q 490 725 464 740 q 537 690 516 710 q 572 649 557 671 l 580 649 q 576 693 578 672 q 573 729 575 711 q 572 759 572 748 l 572 1055 l 696 1055 l 696 0 l 596 0 l 577 99 m 383 88 q 470 104 434 88 q 528 151 506 119 q 560 231 550 183 q 572 342 571 279 l 572 370 q 563 492 572 439 q 532 581 554 545 q 473 636 510 618 q 382 655 437 655 q 247 581 290 655 q 204 369 204 507 q 247 157 204 227 q 383 88 290 88 "},",":{"x_min":43,"x_max":256,"ha":347,"o":"m 245 161 l 256 145 q 233 67 246 108 q 204 -15 220 26 q 170 -99 188 -57 q 136 -179 153 -141 l 43 -179 q 63 -92 53 -137 q 82 -3 72 -48 q 98 82 91 40 q 111 161 106 125 l 245 161 "},"\"":{"x_min":90,"x_max":468.609375,"ha":558,"o":"m 223 992 l 195 634 l 117 634 l 90 992 l 223 992 m 468 992 l 440 634 l 362 634 l 335 992 l 468 992 "},"ľ":{"x_min":118,"x_max":469,"ha":359,"o":"m 241 0 l 118 0 l 118 1055 l 241 1055 l 241 0 m 305 850 q 317 897 311 871 q 329 950 323 923 q 339 1005 334 978 q 346 1055 344 1032 l 469 1055 l 469 1041 q 454 997 464 1024 q 430 942 443 971 q 400 883 416 913 q 370 833 385 854 l 305 833 l 305 850 "},"ė":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 311 945 q 331 1004 311 986 q 382 1023 352 1023 q 411 1018 397 1023 q 434 1004 424 1014 q 449 980 443 995 q 455 945 455 966 q 434 887 455 906 q 382 868 412 868 q 331 886 352 868 q 311 945 311 905 "},"Í":{"x_min":55.34375,"x_max":441,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 174 1089 q 204 1134 188 1108 q 236 1187 220 1160 q 267 1242 252 1215 q 292 1293 281 1269 l 441 1293 l 441 1278 q 408 1233 430 1260 q 361 1175 387 1205 q 307 1118 335 1146 q 256 1071 279 1089 l 174 1071 l 174 1089 "},"Ú":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 401 1089 q 431 1134 415 1108 q 463 1187 447 1160 q 494 1242 479 1215 q 519 1293 508 1269 l 668 1293 l 668 1278 q 635 1233 657 1260 q 588 1175 614 1205 q 534 1118 562 1146 q 483 1071 506 1089 l 401 1071 l 401 1089 "}," ":{"x_min":0,"x_max":0,"ha":278},"Ŷ":{"x_min":-0.25,"x_max":731.25,"ha":732,"o":"m 364 490 l 595 992 l 731 992 l 428 386 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 364 490 m 592 1071 l 510 1071 q 438 1126 475 1093 q 367 1196 402 1159 q 294 1126 330 1159 q 224 1071 258 1093 l 142 1071 l 142 1089 q 182 1134 159 1108 q 228 1187 205 1160 q 271 1242 251 1215 q 301 1293 291 1269 l 432 1293 q 462 1242 442 1269 q 505 1187 482 1215 q 551 1134 528 1160 q 592 1089 575 1108 l 592 1071 "},"Ý":{"x_min":-0.25,"x_max":731.25,"ha":732,"o":"m 364 490 l 595 992 l 731 992 l 428 386 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 364 490 m 299 1089 q 329 1134 313 1108 q 361 1187 345 1160 q 392 1242 377 1215 q 417 1293 406 1269 l 566 1293 l 566 1278 q 533 1233 555 1260 q 486 1175 512 1205 q 432 1118 460 1146 q 381 1071 404 1089 l 299 1071 l 299 1089 "},"ŝ":{"x_min":61.15625,"x_max":564,"ha":627,"o":"m 564 203 q 544 108 564 149 q 487 40 524 68 q 398 0 450 13 q 281 -14 346 -14 q 154 -2 207 -14 q 61 33 101 9 l 61 146 q 107 125 82 135 q 161 106 133 114 q 219 93 189 98 q 279 88 249 88 q 353 95 323 88 q 403 116 384 103 q 431 150 423 130 q 440 194 440 170 q 433 232 440 215 q 409 265 427 249 q 360 299 391 282 q 280 337 329 316 q 193 378 232 358 q 127 424 154 399 q 86 482 100 449 q 72 560 72 515 q 90 645 72 608 q 143 707 109 682 q 224 745 177 732 q 330 758 272 758 q 451 743 396 758 q 554 706 505 729 l 512 606 q 422 641 468 626 q 329 655 376 655 q 228 632 261 655 q 195 568 195 610 q 203 526 195 544 q 229 493 210 509 q 279 461 248 477 q 358 426 311 445 q 444 385 406 405 q 509 339 482 365 q 549 281 535 314 q 564 203 564 249 m 557 842 l 475 842 q 403 897 440 864 q 332 967 367 930 q 259 897 295 930 q 189 842 223 864 l 107 842 l 107 860 q 147 905 124 879 q 193 958 170 931 q 236 1013 216 986 q 266 1064 256 1040 l 397 1064 q 427 1013 407 1040 q 470 958 447 986 q 516 905 493 931 q 557 860 540 879 l 557 842 "}," ":{"x_min":0,"x_max":0,"ha":1389},"ą":{"x_min":64,"x_max":646,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 527 -161 q 545 -206 527 -191 q 587 -220 563 -220 q 620 -218 604 -220 q 646 -214 636 -217 l 646 -291 q 606 -299 628 -296 q 565 -302 585 -302 q 463 -266 497 -302 q 430 -170 430 -231 q 439 -116 430 -142 q 465 -69 449 -91 q 498 -30 480 -48 q 534 0 517 -12 l 621 0 q 527 -161 527 -90 "},"​":{"x_min":0,"x_max":0,"ha":0},"ã":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 473 843 q 419 854 446 843 q 367 881 393 866 q 317 907 341 895 q 272 919 293 919 q 225 901 241 919 q 199 841 209 883 l 129 841 q 143 915 132 882 q 172 972 154 948 q 215 1008 190 995 q 272 1021 240 1021 q 328 1009 300 1021 q 381 982 355 997 q 430 956 407 968 q 473 944 454 944 q 519 962 504 944 q 545 1022 535 980 l 617 1022 q 602 948 613 981 q 573 892 591 915 q 530 855 555 868 q 473 843 505 843 "},"æ":{"x_min":64,"x_max":1088,"ha":1157,"o":"m 64 208 q 142 379 64 320 q 382 445 221 439 l 508 450 l 508 496 q 498 572 508 541 q 469 620 488 602 q 423 647 450 639 q 360 655 395 655 q 254 639 303 655 q 160 599 205 623 l 117 692 q 229 739 167 720 q 359 758 291 758 q 505 729 448 758 q 591 637 562 700 q 681 726 625 694 q 807 758 737 758 q 924 733 872 758 q 1013 665 976 709 q 1068 560 1049 622 q 1088 424 1088 499 l 1088 347 l 634 347 q 687 157 637 218 q 836 96 737 96 q 897 99 869 96 q 952 109 926 103 q 1004 126 979 116 q 1054 148 1029 135 l 1054 36 q 1002 13 1027 23 q 950 -2 977 4 q 895 -11 923 -8 q 833 -14 866 -14 q 672 24 740 -14 q 562 141 604 63 q 513 75 539 104 q 454 27 487 47 q 383 -3 422 7 q 293 -14 343 -14 q 202 0 244 -14 q 130 40 160 12 q 81 109 99 67 q 64 208 64 151 m 191 207 q 224 117 191 146 q 312 88 258 88 q 389 101 354 88 q 451 139 425 113 q 492 204 477 165 q 507 296 507 243 l 507 363 l 408 358 q 305 345 347 355 q 238 315 263 334 q 202 269 213 296 q 191 207 191 241 m 807 655 q 688 603 731 655 q 637 450 644 550 l 960 450 q 951 533 960 495 q 923 598 942 572 q 876 640 904 625 q 807 655 847 655 "},"ĩ":{"x_min":-63,"x_max":425,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 281 843 q 227 854 254 843 q 175 881 201 866 q 125 907 149 895 q 80 919 101 919 q 33 901 49 919 q 7 841 17 883 l -63 841 q -48 915 -59 882 q -19 972 -37 948 q 23 1008 -1 995 q 80 1021 48 1021 q 136 1009 108 1021 q 189 982 163 997 q 238 956 215 968 q 281 944 262 944 q 327 962 312 944 q 353 1022 343 980 l 425 1022 q 410 948 421 981 q 381 892 399 915 q 338 855 363 868 q 281 843 313 843 "},"~":{"x_min":69,"x_max":696,"ha":765,"o":"m 359 441 q 315 459 334 452 q 281 471 297 467 q 252 477 266 475 q 223 479 238 479 q 184 472 204 479 q 143 455 164 466 q 104 429 123 444 q 69 397 85 414 l 69 507 q 237 581 136 581 q 273 579 256 581 q 309 573 290 577 q 350 560 328 568 q 405 538 373 552 q 449 520 430 527 q 483 508 468 512 q 513 502 499 504 q 541 500 527 500 q 581 507 560 500 q 621 524 601 513 q 660 550 641 535 q 696 582 679 565 l 696 472 q 527 399 628 399 q 491 400 508 399 q 455 406 474 402 q 414 419 436 411 q 359 441 391 428 "},"ŀ":{"x_min":118,"x_max":457.46875,"ha":416,"o":"m 241 0 l 118 0 l 118 1055 l 241 1055 l 241 0 m 313 462 q 333 521 313 503 q 384 540 354 540 q 413 535 399 540 q 436 521 426 531 q 451 497 445 512 q 457 462 457 483 q 436 404 457 423 q 384 385 414 385 q 333 403 354 385 q 313 462 313 422 "},"Ċ":{"x_min":85,"x_max":798,"ha":838,"o":"m 538 894 q 406 867 465 894 q 305 788 347 839 q 241 662 264 736 q 218 496 218 588 q 238 326 218 400 q 298 200 258 251 q 398 123 338 150 q 538 97 458 97 q 652 108 598 97 q 760 135 707 120 l 760 26 q 707 8 733 15 q 651 -4 680 0 q 590 -11 622 -9 q 517 -14 557 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 497 85 382 q 114 703 85 609 q 201 864 144 796 q 343 968 258 931 q 538 1006 428 1006 q 677 991 611 1006 q 798 947 744 976 l 745 841 q 652 879 702 863 q 538 894 601 894 m 456 1174 q 476 1233 456 1215 q 527 1252 497 1252 q 556 1247 542 1252 q 579 1233 569 1243 q 594 1209 588 1224 q 600 1174 600 1195 q 579 1116 600 1135 q 527 1097 557 1097 q 476 1115 497 1097 q 456 1174 456 1134 "},"¡":{"x_min":100,"x_max":272.265625,"ha":374,"o":"m 144 458 l 226 458 l 261 -253 l 110 -253 l 144 458 m 272 663 q 265 619 272 637 q 247 590 259 601 q 220 574 235 579 q 186 569 204 569 q 152 574 168 569 q 125 590 137 579 q 106 619 113 601 q 100 663 100 637 q 106 706 100 688 q 125 735 113 724 q 152 752 137 747 q 186 758 168 758 q 220 752 204 758 q 247 735 235 747 q 265 706 259 724 q 272 663 272 688 "},"ẅ":{"x_min":13.75,"x_max":1022.25,"ha":1036,"o":"m 683 0 l 570 417 q 563 445 567 430 q 555 477 559 460 q 546 512 551 494 q 538 546 542 529 q 518 628 528 586 l 514 628 q 496 546 505 585 q 480 476 488 512 q 464 415 471 440 l 347 0 l 204 0 l 13 745 l 143 745 l 232 348 q 245 282 239 318 q 258 211 252 246 q 269 146 264 177 q 277 95 274 115 l 281 95 q 290 142 284 113 q 303 205 296 172 q 317 270 310 238 q 331 324 325 302 l 453 745 l 586 745 l 702 324 q 716 270 709 301 q 732 207 724 239 q 745 145 739 175 q 754 95 751 115 l 758 95 q 764 142 760 113 q 775 207 769 172 q 788 279 781 242 q 803 348 795 316 l 896 745 l 1022 745 l 829 0 l 683 0 m 325 945 q 343 998 325 982 q 390 1015 362 1015 q 436 998 416 1015 q 455 945 455 981 q 436 892 455 909 q 390 876 416 876 q 343 892 362 876 q 325 945 325 909 m 579 945 q 598 998 579 982 q 644 1015 617 1015 q 669 1010 657 1015 q 690 998 681 1006 q 704 977 699 989 q 710 945 710 964 q 690 892 710 909 q 644 876 670 876 q 598 892 617 876 q 579 945 579 909 "},"К":{"x_min":135,"x_max":804.25,"ha":804,"o":"m 804 0 l 655 0 l 261 502 l 261 0 l 135 0 l 135 992 l 261 992 l 261 511 l 644 992 l 784 992 l 401 515 l 804 0 "},"Γ":{"x_min":135,"x_max":649,"ha":682,"o":"m 649 992 l 649 880 l 261 880 l 261 0 l 135 0 l 135 992 l 649 992 "},"P":{"x_min":135,"x_max":729,"ha":800,"o":"m 729 701 q 710 582 729 639 q 648 482 691 525 q 536 412 606 438 q 362 386 465 386 l 261 386 l 261 0 l 135 0 l 135 992 l 380 992 q 537 972 471 992 q 645 916 602 953 q 708 825 688 879 q 729 701 729 770 m 261 493 l 347 493 q 456 504 410 493 q 533 539 503 515 q 579 601 564 563 q 595 695 595 640 q 540 837 595 791 q 368 884 485 884 l 261 884 l 261 493 "},"%":{"x_min":69,"x_max":1076,"ha":1146,"o":"m 169 695 q 193 527 169 583 q 271 471 217 471 q 377 695 377 471 q 271 917 377 917 q 193 862 217 917 q 169 695 169 807 m 478 695 q 465 564 478 622 q 428 465 453 505 q 364 404 403 425 q 271 383 325 383 q 184 404 222 383 q 120 465 146 425 q 81 564 94 505 q 69 695 69 622 q 80 826 69 769 q 117 924 92 884 q 180 984 142 963 q 271 1006 218 1006 q 360 984 322 1006 q 425 924 399 963 q 464 826 451 884 q 478 695 478 769 m 768 297 q 792 129 768 185 q 870 74 816 74 q 975 297 975 74 q 870 519 975 519 q 792 464 816 519 q 768 297 768 409 m 1076 298 q 1064 166 1076 224 q 1027 68 1052 108 q 963 7 1002 28 q 870 -14 924 -14 q 782 7 820 -14 q 719 68 744 28 q 680 166 693 108 q 668 298 668 224 q 679 428 668 371 q 716 526 691 486 q 779 586 741 565 q 870 608 817 608 q 959 586 921 608 q 1023 526 998 565 q 1062 428 1049 486 q 1076 298 1076 371 m 902 992 l 351 0 l 244 0 l 795 992 l 902 992 "},"ϖ":{"x_min":11.828125,"x_max":1106.265625,"ha":1150,"o":"m 374 -14 q 185 65 251 -14 q 119 310 119 145 q 125 392 119 349 q 142 477 131 434 q 167 562 152 520 q 199 642 182 604 l 11 642 l 11 691 l 102 745 l 1106 745 l 1106 642 l 941 642 q 970 562 957 604 q 992 477 983 520 q 1006 392 1001 434 q 1012 310 1012 349 q 945 65 1012 145 q 756 -14 879 -14 q 637 15 684 -14 q 569 106 590 45 l 562 106 q 493 15 541 45 q 374 -14 446 -14 m 321 642 q 293 565 306 605 q 269 484 279 525 q 252 401 258 442 q 246 320 246 359 q 256 208 246 253 q 284 137 266 164 q 327 99 302 110 q 382 88 352 88 q 436 102 413 88 q 474 140 459 116 q 496 198 489 165 q 504 270 504 231 l 504 390 l 627 390 l 627 270 q 660 135 627 182 q 748 88 693 88 q 803 99 778 88 q 846 137 828 110 q 874 208 865 164 q 884 320 884 253 q 879 401 884 359 q 865 484 874 442 q 845 565 857 525 q 819 642 833 605 l 321 642 "},"_":{"x_min":-3,"x_max":574,"ha":571,"o":"m 574 -219 l -3 -219 l -3 -125 l 574 -125 l 574 -219 "},"ñ":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 0 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 0 l 583 0 m 514 843 q 460 854 487 843 q 408 881 434 866 q 358 907 382 895 q 313 919 334 919 q 266 901 282 919 q 240 841 250 883 l 170 841 q 184 915 173 882 q 213 972 195 948 q 256 1008 231 995 q 313 1021 281 1021 q 369 1009 341 1021 q 422 982 396 997 q 471 956 448 968 q 514 944 495 944 q 560 962 545 944 q 586 1022 576 980 l 658 1022 q 643 948 654 981 q 614 892 632 915 q 571 855 596 868 q 514 843 546 843 "},"Ŕ":{"x_min":135,"x_max":803.25,"ha":819,"o":"m 261 410 l 261 0 l 135 0 l 135 992 l 376 992 q 642 922 556 992 q 729 710 729 852 q 712 607 729 651 q 668 531 695 563 q 605 479 640 500 q 533 444 570 458 l 803 0 l 654 0 l 416 410 l 261 410 m 261 517 l 371 517 q 473 529 431 517 q 543 564 516 541 q 582 623 570 588 q 595 704 595 658 q 581 787 595 753 q 540 842 567 821 q 469 874 512 864 q 368 884 426 884 l 261 884 l 261 517 m 324 1089 q 354 1134 338 1108 q 386 1187 370 1160 q 417 1242 402 1215 q 442 1293 431 1269 l 591 1293 l 591 1278 q 558 1233 580 1260 q 511 1175 537 1205 q 457 1118 485 1146 q 406 1071 429 1089 l 324 1071 l 324 1089 "},"‚":{"x_min":43,"x_max":256,"ha":347,"o":"m 246 161 l 256 145 q 233 67 246 108 q 204 -15 220 26 q 170 -99 188 -57 q 136 -179 153 -141 l 43 -179 q 66 -92 54 -137 q 88 -3 77 -48 q 107 82 98 40 q 122 161 116 125 l 246 161 "},"⅞":{"x_min":77,"x_max":1011,"ha":1051,"o":"m 141 397 l 363 908 l 77 908 l 77 992 l 460 992 l 460 924 l 243 397 l 141 397 m 804 992 l 253 0 l 146 0 l 697 992 l 804 992 m 815 604 q 883 594 851 604 q 938 567 914 585 q 976 519 962 548 q 991 453 991 491 q 983 407 991 428 q 962 369 976 386 q 931 338 949 352 q 893 313 914 325 q 938 285 917 300 q 975 251 959 270 q 1001 209 991 233 q 1011 157 1011 186 q 996 87 1011 119 q 956 33 982 56 q 894 0 930 11 q 816 -13 858 -13 q 670 31 721 -13 q 620 153 620 75 q 628 205 620 182 q 651 247 636 228 q 684 281 665 266 q 724 307 703 295 q 690 335 705 321 q 662 368 674 350 q 644 407 650 386 q 638 453 638 428 q 652 519 638 491 q 691 566 667 547 q 748 594 716 585 q 815 604 780 604 m 716 155 q 741 93 716 116 q 814 70 766 70 q 888 93 863 70 q 914 155 914 116 q 906 190 914 174 q 885 219 899 206 q 854 242 872 232 q 813 262 835 253 l 802 266 q 738 219 760 244 q 716 155 716 193 m 813 520 q 755 502 776 520 q 734 449 734 484 q 741 417 734 431 q 757 392 747 404 q 783 371 768 380 q 815 353 798 361 q 846 370 831 360 q 871 390 860 379 q 887 416 881 402 q 894 449 894 430 q 872 502 894 484 q 813 520 850 520 "},"Æ":{"x_min":-1.25,"x_max":1101,"ha":1184,"o":"m 1101 0 l 585 0 l 585 307 l 262 307 l 124 0 l -1 0 l 443 992 l 1101 992 l 1101 880 l 711 880 l 711 574 l 1075 574 l 1075 462 l 711 462 l 711 111 l 1101 111 l 1101 0 m 311 419 l 585 419 l 585 880 l 512 880 l 311 419 "},"₣":{"x_min":65,"x_max":694,"ha":765,"o":"m 310 271 l 503 271 l 503 163 l 310 163 l 310 0 l 184 0 l 184 163 l 65 163 l 65 271 l 184 271 l 184 992 l 694 992 l 694 880 l 310 880 l 310 531 l 668 531 l 668 419 l 310 419 l 310 271 "},"Ū":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 290 1172 l 680 1172 l 680 1071 l 290 1071 l 290 1172 "},"ы":{"x_min":118,"x_max":922,"ha":1040,"o":"m 241 439 l 401 439 q 613 386 544 439 q 683 227 683 333 q 667 133 683 175 q 616 61 651 91 q 528 15 582 31 q 398 0 475 0 l 118 0 l 118 745 l 241 745 l 241 439 m 922 0 l 798 0 l 798 745 l 922 745 l 922 0 m 241 336 l 241 102 l 388 102 q 457 108 426 102 q 511 127 488 113 q 546 164 534 141 q 559 219 559 186 q 548 275 559 252 q 515 311 537 297 q 461 330 493 325 q 386 336 429 336 l 241 336 "},"ѓ":{"x_min":118,"x_max":527,"ha":555,"o":"m 527 642 l 241 642 l 241 0 l 118 0 l 118 745 l 527 745 l 527 642 m 236 860 q 266 905 250 879 q 298 958 282 931 q 329 1013 314 986 q 354 1064 343 1040 l 503 1064 l 503 1049 q 470 1004 492 1031 q 423 946 449 976 q 369 889 397 917 q 318 842 341 860 l 236 842 l 236 860 "},"Œ":{"x_min":85,"x_max":1153,"ha":1236,"o":"m 1153 0 l 639 0 q 578 -10 609 -6 q 515 -14 548 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 516 1007 406 1007 q 640 992 583 1007 l 1153 992 l 1153 880 l 764 880 l 764 574 l 1127 574 l 1127 462 l 764 462 l 764 111 l 1153 111 l 1153 0 m 517 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 581 103 551 97 q 638 119 612 109 l 638 873 q 582 890 612 884 q 517 895 551 895 "},"΅":{"x_min":187,"x_max":614,"ha":802,"o":"m 346 959 q 361 1005 353 980 q 378 1057 370 1030 q 393 1112 386 1084 q 406 1164 401 1139 l 547 1164 l 547 1150 q 518 1102 534 1128 q 483 1049 502 1076 q 443 994 464 1022 q 401 942 423 967 l 346 942 l 346 959 m 187 945 q 201 998 187 982 q 236 1015 215 1015 q 254 1010 245 1015 q 270 998 263 1006 q 280 977 276 989 q 284 945 284 964 q 269 892 284 909 q 236 876 255 876 q 201 892 215 876 q 187 945 187 909 m 516 945 q 530 998 516 982 q 565 1015 544 1015 q 583 1010 574 1015 q 599 998 592 1006 q 609 977 605 989 q 614 945 614 964 q 599 892 614 909 q 565 876 584 876 q 530 892 544 876 q 516 945 516 909 "},"Ą":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 706 -161 q 724 -206 706 -191 q 766 -220 742 -220 q 799 -218 783 -220 q 825 -214 815 -217 l 825 -291 q 785 -299 807 -296 q 744 -302 764 -302 q 642 -266 676 -302 q 609 -170 609 -231 q 618 -116 609 -142 q 644 -69 628 -91 q 677 -30 659 -48 q 713 0 696 -12 l 800 0 q 706 -161 706 -90 "},"Њ":{"x_min":135,"x_max":1224,"ha":1295,"o":"m 1224 290 q 1203 170 1224 224 q 1140 79 1183 117 q 1031 20 1097 41 q 874 0 965 0 l 656 0 l 656 462 l 261 462 l 261 0 l 135 0 l 135 992 l 261 992 l 261 574 l 656 574 l 656 992 l 782 992 l 782 574 l 856 574 q 1030 551 959 574 q 1143 490 1100 529 q 1205 400 1186 452 q 1224 290 1224 349 m 782 107 l 862 107 q 1035 152 979 107 q 1090 290 1090 197 q 1074 370 1090 337 q 1028 424 1059 403 q 951 453 997 444 q 841 462 904 462 l 782 462 l 782 107 "},"›":{"x_min":56,"x_max":343.5,"ha":400,"o":"m 343 356 l 134 78 l 56 130 l 216 367 l 56 603 l 134 656 l 343 375 l 343 356 "},"ћ":{"x_min":12.1875,"x_max":707,"ha":818,"o":"m 583 0 l 583 451 q 547 583 583 539 q 436 627 512 627 q 343 609 381 627 q 283 557 306 592 q 251 473 261 523 q 241 357 241 422 l 241 0 l 118 0 l 118 843 l 12 843 l 12 932 l 118 932 l 118 1055 l 241 1055 l 241 932 l 498 932 l 498 843 l 241 843 l 241 715 l 236 616 l 242 616 q 283 666 259 645 q 334 702 306 687 q 393 723 362 716 q 457 730 424 730 q 644 665 581 730 q 707 458 707 600 l 707 0 l 583 0 "},"<":{"x_min":69,"x_max":696,"ha":765,"o":"m 696 161 l 69 448 l 69 517 l 696 844 l 696 735 l 197 488 l 696 270 l 696 161 "},"¬":{"x_min":69,"x_max":696,"ha":765,"o":"m 696 541 l 696 178 l 594 178 l 594 439 l 69 439 l 69 541 l 696 541 "},"t":{"x_min":23,"x_max":445,"ha":471,"o":"m 343 88 q 371 89 355 88 q 400 93 386 91 q 426 97 415 95 q 445 102 438 100 l 445 8 q 422 0 436 3 q 392 -7 409 -4 q 358 -12 376 -10 q 324 -14 341 -14 q 246 -3 282 -14 q 184 34 210 7 q 142 106 157 61 q 128 221 128 152 l 128 656 l 23 656 l 23 709 l 128 759 l 180 915 l 251 915 l 251 745 l 439 745 l 439 656 l 251 656 l 251 221 q 272 121 251 155 q 343 88 294 88 "},"Ц":{"x_min":135,"x_max":945,"ha":973,"o":"m 826 111 l 945 111 l 945 -261 l 818 -261 l 818 0 l 135 0 l 135 992 l 261 992 l 261 111 l 699 111 l 699 992 l 826 992 l 826 111 "},"ù":{"x_min":111,"x_max":700,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 471 842 l 389 842 q 337 889 365 860 q 283 946 309 917 q 236 1004 257 976 q 204 1049 214 1031 l 204 1064 l 352 1064 q 378 1013 363 1040 q 408 958 392 986 q 440 905 424 931 q 471 860 456 879 l 471 842 "},"ï":{"x_min":-13,"x_max":372,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m -13 945 q 5 998 -13 982 q 52 1015 24 1015 q 98 998 78 1015 q 117 945 117 981 q 98 892 117 909 q 52 876 78 876 q 5 892 24 876 q -13 945 -13 909 m 241 945 q 260 998 241 982 q 306 1015 279 1015 q 331 1010 319 1015 q 352 998 343 1006 q 366 977 361 989 q 372 945 372 964 q 352 892 372 909 q 306 876 332 876 q 260 892 279 876 q 241 945 241 909 "},"Ф":{"x_min":71,"x_max":994,"ha":1065,"o":"m 468 1006 l 594 1006 l 594 884 l 643 884 q 801 852 735 884 q 910 768 867 820 q 973 649 953 716 q 994 514 994 583 q 985 429 994 472 q 959 343 977 385 q 913 264 942 301 q 844 199 885 227 q 749 155 803 171 q 626 139 694 139 l 594 139 l 594 -14 l 468 -14 l 468 139 l 436 139 q 314 155 368 139 q 220 199 260 171 q 151 264 179 227 q 105 343 122 301 q 79 429 87 385 q 71 514 71 472 q 91 649 71 583 q 154 768 112 716 q 262 852 197 820 q 418 884 328 884 l 468 884 l 468 1006 m 594 246 l 611 246 q 721 266 674 246 q 798 322 768 286 q 844 408 829 358 q 860 517 860 458 q 846 617 860 570 q 804 700 832 665 q 734 755 776 735 q 632 776 691 776 l 594 776 l 594 246 m 468 776 l 429 776 q 329 755 371 776 q 259 700 287 735 q 217 617 231 665 q 204 517 204 570 q 219 408 204 458 q 265 322 235 358 q 342 266 295 286 q 450 246 388 246 l 468 246 l 468 776 "},"Ò":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 591 1071 l 509 1071 q 457 1118 485 1089 q 403 1175 429 1146 q 356 1233 377 1205 q 324 1278 334 1260 l 324 1293 l 472 1293 q 498 1242 483 1269 q 528 1187 512 1215 q 560 1134 544 1160 q 591 1089 576 1108 l 591 1071 "},"I":{"x_min":55.34375,"x_max":414.8125,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 "},"˝":{"x_min":151,"x_max":649,"ha":802,"o":"m 151 860 q 181 905 165 879 q 213 958 197 931 q 243 1013 229 986 q 269 1064 258 1040 l 404 1064 l 404 1049 q 371 1004 393 1031 q 324 946 350 976 q 270 889 298 917 q 219 842 243 860 l 151 842 l 151 860 m 397 860 q 427 905 411 879 q 459 958 443 931 q 489 1013 475 986 q 514 1064 504 1040 l 649 1064 l 649 1049 q 616 1004 638 1031 q 569 946 595 976 q 515 889 543 917 q 464 842 488 860 l 397 842 l 397 860 "},"·":{"x_min":100,"x_max":272,"ha":372,"o":"m 100 490 q 106 534 100 516 q 125 563 113 552 q 152 579 136 574 q 186 585 167 585 q 219 579 203 585 q 246 563 235 574 q 265 534 258 552 q 272 490 272 516 q 265 447 272 465 q 246 418 258 430 q 219 401 235 406 q 186 396 203 396 q 152 401 167 396 q 125 418 136 406 q 106 447 113 430 q 100 490 100 465 "},"¿":{"x_min":46,"x_max":567,"ha":591,"o":"m 401 458 l 401 432 q 395 362 401 393 q 376 304 390 331 q 341 251 363 276 q 285 196 319 225 q 229 146 252 169 q 191 100 206 123 q 169 50 176 76 q 162 -12 162 23 q 172 -72 162 -45 q 202 -118 183 -99 q 250 -148 221 -138 q 317 -159 279 -159 q 425 -141 374 -159 q 523 -100 476 -124 l 567 -199 q 447 -247 511 -227 q 318 -267 383 -267 q 204 -249 254 -267 q 118 -199 153 -232 q 64 -120 83 -167 q 46 -14 46 -73 q 54 67 46 32 q 79 133 62 102 q 120 192 95 163 q 179 252 145 220 q 231 305 211 283 q 263 349 252 328 q 280 393 275 370 q 284 445 284 415 l 284 458 l 401 458 m 433 663 q 426 619 433 637 q 408 590 420 601 q 380 574 396 579 q 346 569 365 569 q 313 574 329 569 q 286 590 298 579 q 267 619 274 601 q 260 663 260 637 q 267 706 260 688 q 286 735 274 724 q 313 752 298 747 q 346 758 329 758 q 380 752 365 758 q 408 735 396 747 q 426 706 420 724 q 433 663 433 688 "},"ſ":{"x_min":118,"x_max":476,"ha":399,"o":"m 118 0 l 118 814 q 133 934 118 886 q 177 1010 148 982 q 248 1051 206 1039 q 343 1063 290 1063 q 416 1055 383 1063 q 476 1037 450 1047 l 444 941 q 398 954 423 949 q 347 960 374 960 q 300 954 320 960 q 267 931 280 947 q 247 887 254 915 q 241 814 241 858 l 241 0 l 118 0 "},"Ђ":{"x_min":13,"x_max":873,"ha":977,"o":"m 628 -14 q 572 -9 596 -14 q 532 2 548 -5 l 532 111 q 574 101 551 105 q 624 97 597 97 q 667 103 646 97 q 707 127 689 110 q 735 174 724 144 q 746 250 746 203 l 746 340 q 711 458 746 419 q 591 497 675 497 l 370 497 l 370 0 l 244 0 l 244 880 l 13 880 l 13 992 l 654 992 l 654 880 l 370 880 l 370 609 l 605 609 q 718 592 668 609 q 802 543 768 575 q 854 464 836 511 q 873 356 873 417 l 873 263 q 855 140 873 192 q 804 53 837 87 q 727 2 772 19 q 628 -14 682 -14 "},"ű":{"x_min":111,"x_max":704,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 206 860 q 236 905 220 879 q 268 958 252 931 q 298 1013 284 986 q 324 1064 313 1040 l 459 1064 l 459 1049 q 426 1004 448 1031 q 379 946 405 976 q 325 889 353 917 q 274 842 298 860 l 206 842 l 206 860 m 452 860 q 482 905 466 879 q 514 958 498 931 q 544 1013 530 986 q 569 1064 559 1040 l 704 1064 l 704 1049 q 671 1004 693 1031 q 624 946 650 976 q 570 889 598 917 q 519 842 543 860 l 452 842 l 452 860 "},"Ǽ":{"x_min":-1.25,"x_max":1101,"ha":1184,"o":"m 1101 0 l 585 0 l 585 307 l 262 307 l 124 0 l -1 0 l 443 992 l 1101 992 l 1101 880 l 711 880 l 711 574 l 1075 574 l 1075 462 l 711 462 l 711 111 l 1101 111 l 1101 0 m 311 419 l 585 419 l 585 880 l 512 880 l 311 419 m 639 1089 q 669 1134 653 1108 q 701 1187 685 1160 q 732 1242 717 1215 q 757 1293 746 1269 l 906 1293 l 906 1278 q 873 1233 895 1260 q 826 1175 852 1205 q 772 1118 800 1146 q 721 1071 744 1089 l 639 1071 l 639 1089 "},"φ":{"x_min":77,"x_max":893,"ha":970,"o":"m 417 -334 l 417 -12 q 280 14 343 -8 q 173 83 218 36 q 102 201 127 129 q 77 376 77 274 q 87 484 77 432 q 117 582 98 535 q 163 671 136 629 q 220 751 189 713 l 315 686 q 269 616 290 651 q 232 542 247 581 q 208 462 217 504 q 200 371 200 419 q 217 244 200 296 q 264 160 235 193 q 334 111 294 127 q 417 90 373 95 l 417 500 q 472 692 417 627 q 626 758 528 758 q 737 730 687 758 q 821 654 786 703 q 874 538 855 606 q 893 387 893 469 q 864 212 893 286 q 786 90 835 139 q 674 16 738 41 q 540 -12 610 -8 l 540 -334 l 417 -334 m 765 386 q 755 502 765 452 q 727 586 745 552 q 684 638 709 621 q 631 655 660 655 q 596 647 613 655 q 567 622 580 640 q 547 574 555 604 q 540 501 540 545 l 540 90 q 630 115 588 95 q 701 171 671 135 q 748 261 731 207 q 765 386 765 314 "},";":{"x_min":43,"x_max":272,"ha":372,"o":"m 245 161 l 256 145 q 233 67 246 108 q 204 -15 220 26 q 170 -99 188 -57 q 136 -179 153 -141 l 43 -179 q 63 -92 53 -137 q 82 -3 72 -48 q 98 82 91 40 q 111 161 106 125 l 245 161 m 100 669 q 106 714 100 696 q 125 743 113 732 q 152 759 136 754 q 186 764 167 764 q 219 759 203 764 q 246 743 235 754 q 265 714 258 732 q 272 669 272 696 q 265 626 272 644 q 246 597 258 609 q 219 580 235 585 q 186 575 203 575 q 152 580 167 575 q 125 597 136 585 q 106 626 113 609 q 100 669 100 644 "},"Ș":{"x_min":70.109375,"x_max":657,"ha":721,"o":"m 657 264 q 633 147 657 199 q 566 59 610 95 q 460 4 523 23 q 320 -14 398 -14 q 179 -2 245 -14 q 70 32 114 9 l 70 153 q 122 131 93 142 q 184 112 151 120 q 251 99 216 104 q 319 93 285 93 q 479 134 427 93 q 530 252 530 176 q 521 316 530 289 q 486 366 511 343 q 420 410 461 389 q 316 456 379 431 q 212 508 256 480 q 139 572 168 537 q 96 652 110 607 q 83 754 83 697 q 104 860 83 813 q 165 939 126 907 q 259 989 205 972 q 380 1006 314 1006 q 525 990 460 1006 q 640 951 589 975 l 595 845 q 495 880 551 865 q 381 894 440 894 q 254 856 299 894 q 209 752 209 818 q 219 686 209 714 q 252 635 229 657 q 315 592 276 612 q 410 549 353 572 q 517 499 471 525 q 594 441 563 473 q 641 366 625 408 q 657 264 657 323 m 249 -288 q 265 -246 256 -271 q 282 -191 274 -220 q 296 -135 290 -163 q 305 -85 303 -107 l 428 -85 l 428 -98 q 413 -141 423 -115 q 387 -197 402 -167 q 353 -255 372 -226 q 315 -307 335 -284 l 249 -307 l 249 -288 "},"Ġ":{"x_min":85,"x_max":858,"ha":958,"o":"m 530 524 l 858 524 l 858 36 q 782 15 820 24 q 704 0 744 5 q 620 -10 664 -7 q 526 -14 576 -14 q 337 21 419 -14 q 199 123 255 57 q 114 284 143 189 q 85 497 85 378 q 117 708 85 613 q 211 868 149 802 q 363 970 272 934 q 569 1006 453 1006 q 713 991 644 1006 q 842 947 782 976 l 793 837 q 741 859 769 849 q 683 877 713 869 q 621 890 653 885 q 559 894 590 894 q 412 867 476 894 q 306 788 349 839 q 240 662 263 736 q 218 496 218 588 q 237 334 218 407 q 296 208 255 261 q 401 126 336 155 q 556 97 465 97 q 610 98 585 97 q 656 103 635 100 q 695 109 677 106 q 731 116 714 113 l 731 412 l 530 412 l 530 524 m 464 1174 q 484 1233 464 1215 q 535 1252 505 1252 q 564 1247 550 1252 q 587 1233 577 1243 q 602 1209 596 1224 q 608 1174 608 1195 q 587 1116 608 1135 q 535 1097 565 1097 q 484 1115 505 1097 q 464 1174 464 1134 "},"6":{"x_min":77,"x_max":701,"ha":765,"o":"m 77 423 q 84 565 77 494 q 109 700 91 636 q 158 821 127 765 q 237 918 189 877 q 352 982 285 959 q 509 1006 419 1006 q 538 1005 522 1006 q 569 1002 553 1004 q 600 998 585 1001 q 626 992 614 996 l 626 884 q 573 896 602 892 q 514 900 543 900 q 407 886 453 900 q 327 845 361 872 q 271 783 294 819 q 234 703 248 747 q 213 609 220 659 q 205 505 207 559 l 213 505 q 245 551 226 530 q 290 588 265 572 q 348 612 316 603 q 420 621 380 621 q 536 600 484 621 q 624 542 588 580 q 681 447 661 503 q 701 319 701 391 q 680 180 701 242 q 619 75 659 118 q 524 9 580 32 q 400 -14 469 -14 q 273 12 332 -14 q 170 93 213 38 q 102 229 127 147 q 77 423 77 311 m 399 91 q 473 105 440 91 q 531 147 506 118 q 568 218 555 175 q 581 320 581 261 q 570 405 581 367 q 537 469 559 442 q 481 509 514 495 q 403 524 448 524 q 321 508 358 524 q 257 466 283 492 q 216 408 231 441 q 202 343 202 376 q 214 253 202 298 q 251 172 227 208 q 313 113 276 136 q 399 91 350 91 "},"n":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 0 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 0 l 583 0 "},"ά":{"x_min":77,"x_max":792.984375,"ha":814,"o":"m 383 88 q 470 104 434 88 q 528 153 506 120 q 560 238 550 186 q 572 360 571 289 l 572 370 q 563 492 572 439 q 532 581 554 545 q 473 636 510 618 q 382 655 437 655 q 247 581 290 655 q 204 369 204 507 q 247 157 204 227 q 383 88 290 88 m 359 -14 q 244 10 296 -14 q 154 83 192 34 q 97 203 117 131 q 77 370 77 275 q 97 538 77 466 q 156 659 118 610 q 249 733 194 708 q 372 758 304 758 q 497 729 448 758 q 579 644 546 701 l 587 644 q 605 695 594 667 q 633 745 616 723 l 730 745 q 716 687 723 722 q 705 610 710 651 q 698 527 701 569 q 696 446 696 484 l 696 162 q 712 104 696 121 q 752 87 729 87 q 775 89 762 87 q 792 93 787 91 l 792 3 q 760 -8 782 -2 q 715 -14 738 -14 q 668 -8 689 -14 q 630 10 647 -3 q 601 45 613 23 q 580 99 588 66 l 572 99 q 537 55 557 76 q 491 19 517 34 q 432 -5 465 3 q 359 -14 400 -14 m 359 860 q 372 906 365 880 q 385 960 379 932 q 397 1014 392 987 q 406 1064 403 1041 l 541 1064 l 541 1049 q 525 1007 536 1033 q 499 951 514 980 q 466 892 483 921 q 432 842 448 863 l 359 842 l 359 860 "},"ϊ":{"x_min":14,"x_max":428,"ha":454,"o":"m 234 743 l 234 220 q 255 121 234 154 q 326 88 277 88 q 353 89 338 88 q 383 93 368 91 q 409 97 397 95 q 428 102 421 100 l 428 8 q 405 0 419 3 q 375 -7 391 -4 q 341 -12 358 -10 q 307 -14 323 -14 q 229 -3 265 -14 q 167 34 193 7 q 125 105 140 60 q 111 219 111 150 l 111 743 l 234 743 m 14 945 q 32 998 14 982 q 79 1015 51 1015 q 125 998 105 1015 q 144 945 144 981 q 125 892 144 909 q 79 876 105 876 q 32 892 51 876 q 14 945 14 909 m 268 945 q 287 998 268 982 q 333 1015 306 1015 q 358 1010 346 1015 q 379 998 370 1006 q 393 977 388 989 q 399 945 399 964 q 379 892 399 909 q 333 876 359 876 q 287 892 306 876 q 268 945 268 909 "},"﻿":{"x_min":0,"x_max":0,"ha":0},"ģ":{"x_min":25,"x_max":692.484375,"ha":720,"o":"m 692 745 l 692 668 l 559 649 q 591 588 578 625 q 604 504 604 551 q 588 409 604 453 q 539 333 572 365 q 459 283 507 301 q 348 266 412 266 q 319 266 333 266 q 294 268 304 266 q 271 253 282 261 q 251 233 260 244 q 236 208 242 222 q 230 178 230 194 q 238 148 230 159 q 260 130 246 136 q 293 122 274 124 q 333 120 312 120 l 453 120 q 560 104 516 120 q 631 61 603 88 q 670 -2 658 34 q 683 -80 683 -38 q 660 -186 683 -139 q 593 -266 638 -233 q 478 -316 547 -298 q 314 -334 408 -334 q 187 -319 241 -334 q 96 -278 132 -305 q 42 -213 60 -251 q 25 -128 25 -175 q 38 -57 25 -87 q 73 -4 51 -26 q 125 32 96 17 q 187 53 155 46 q 140 94 158 66 q 122 159 122 122 q 143 231 122 201 q 212 291 165 262 q 158 324 182 303 q 118 373 134 346 q 92 433 101 401 q 83 500 83 466 q 99 608 83 561 q 150 689 116 656 q 233 740 183 722 q 348 758 282 758 q 400 754 373 758 q 445 745 427 750 l 692 745 m 141 -126 q 150 -173 141 -151 q 179 -211 159 -195 q 232 -235 199 -226 q 314 -245 265 -245 q 503 -205 440 -245 q 566 -92 566 -166 q 558 -41 566 -61 q 531 -10 550 -21 q 482 4 512 0 q 407 8 451 8 l 287 8 q 238 3 263 8 q 190 -17 212 -2 q 155 -58 169 -32 q 141 -126 141 -84 m 206 504 q 242 388 206 426 q 344 350 278 350 q 446 388 411 350 q 480 506 480 426 q 445 629 480 590 q 343 669 410 669 q 241 628 277 669 q 206 504 206 587 m 467 1045 q 450 1003 458 1028 q 433 948 441 977 q 418 892 424 920 q 410 842 412 864 l 288 842 l 288 856 q 302 898 291 872 q 328 954 312 925 q 362 1012 343 983 q 400 1064 381 1041 l 467 1064 l 467 1045 "},"∂":{"x_min":66,"x_max":734,"ha":807,"o":"m 734 633 q 723 485 734 561 q 690 336 712 408 q 633 201 668 264 q 552 89 599 137 q 446 13 506 41 q 312 -14 386 -14 q 192 8 240 -14 q 117 68 145 30 q 77 153 89 105 q 66 254 66 202 q 73 342 66 294 q 98 438 81 390 q 142 530 115 486 q 209 609 170 575 q 299 664 247 643 q 417 685 351 685 q 529 658 479 685 q 609 584 578 631 q 610 611 610 597 q 610 633 610 626 q 563 831 610 762 q 424 899 516 899 q 380 895 403 899 q 334 883 357 891 q 289 865 311 876 q 249 841 268 854 l 249 959 q 288 975 266 968 q 336 989 311 983 q 389 998 362 995 q 441 1002 415 1002 q 582 971 525 1002 q 671 890 638 941 q 719 773 705 839 q 734 633 734 706 m 319 88 q 387 103 355 88 q 446 145 418 118 q 496 207 473 171 q 537 285 519 243 q 567 373 555 327 q 586 465 580 419 q 566 516 580 492 q 532 557 552 540 q 487 585 512 575 q 434 596 462 596 q 358 579 392 596 q 296 535 323 563 q 250 471 270 507 q 218 397 230 435 q 199 321 205 359 q 193 251 193 283 q 200 186 193 216 q 222 135 207 157 q 261 100 238 113 q 319 88 285 88 "},"κ":{"x_min":118,"x_max":684.25,"ha":689,"o":"m 545 0 l 315 331 l 241 276 l 241 0 l 118 0 l 118 745 l 241 745 l 241 554 q 239 479 241 513 q 236 418 238 444 q 230 364 233 388 l 319 483 l 526 745 l 665 745 l 394 412 l 684 0 l 545 0 "},"‡":{"x_min":84,"x_max":606.171875,"ha":689,"o":"m 380 336 l 606 357 l 606 235 l 380 256 l 418 0 l 271 0 l 308 256 l 84 235 l 84 357 l 308 336 l 277 532 l 308 718 l 84 697 l 84 820 l 308 799 l 271 1055 l 418 1055 l 380 799 l 606 820 l 606 697 l 380 718 l 412 532 l 380 336 "},"ň":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 0 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 0 l 583 0 m 634 1045 q 593 1000 617 1026 q 547 947 570 974 q 504 892 524 919 q 474 842 484 865 l 343 842 q 313 892 333 865 q 270 947 293 919 q 224 1000 247 974 q 184 1045 201 1026 l 184 1064 l 266 1064 q 336 1008 300 1041 q 409 937 372 975 q 480 1008 444 975 q 552 1064 517 1041 l 634 1064 l 634 1045 "},"√":{"x_min":25,"x_max":828.25,"ha":762,"o":"m 424 -10 l 334 -10 l 147 522 l 25 522 l 25 615 l 226 615 l 381 165 l 729 1150 l 828 1150 l 424 -10 "},"ę":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 506 -140 q 524 -185 506 -170 q 566 -199 542 -199 q 599 -197 583 -199 q 625 -193 615 -196 l 625 -270 q 585 -278 607 -275 q 544 -281 564 -281 q 442 -245 476 -281 q 409 -149 409 -210 q 418 -95 409 -121 q 444 -48 428 -70 q 477 -9 459 -27 q 513 21 496 8 l 600 21 q 506 -140 506 -69 "},"į":{"x_min":47,"x_max":263,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 108 945 q 129 1004 108 986 q 180 1023 149 1023 q 208 1018 195 1023 q 231 1004 221 1014 q 247 980 241 995 q 252 945 252 966 q 231 887 252 906 q 180 868 210 868 q 129 886 149 868 q 108 945 108 905 m 144 -161 q 162 -206 144 -191 q 204 -220 180 -220 q 237 -218 221 -220 q 263 -214 253 -217 l 263 -291 q 223 -299 245 -296 q 182 -302 202 -302 q 80 -266 114 -302 q 47 -170 47 -231 q 56 -116 47 -142 q 82 -69 66 -91 q 115 -30 97 -48 q 151 0 134 -12 l 238 0 q 144 -161 144 -90 "},"Τ":{"x_min":14,"x_max":706,"ha":721,"o":"m 423 0 l 297 0 l 297 880 l 14 880 l 14 992 l 706 992 l 706 880 l 423 880 l 423 0 "},"≈":{"x_min":69,"x_max":696,"ha":765,"o":"m 359 300 q 315 318 334 311 q 281 330 297 326 q 252 336 266 334 q 223 338 238 338 q 184 331 204 338 q 143 314 164 325 q 104 288 123 303 q 69 256 85 273 l 69 366 q 237 440 136 440 q 273 438 256 440 q 309 432 290 436 q 350 419 328 427 q 405 397 373 411 q 449 379 430 386 q 483 367 468 371 q 513 361 499 363 q 541 359 527 359 q 581 366 560 359 q 621 383 601 372 q 660 409 641 394 q 696 441 679 424 l 696 331 q 527 258 628 258 q 491 259 508 258 q 455 265 474 261 q 414 278 436 270 q 359 300 391 287 m 359 578 q 315 596 334 589 q 281 608 297 604 q 252 614 266 612 q 223 616 238 616 q 184 609 204 616 q 143 592 164 603 q 104 566 123 581 q 69 533 85 551 l 69 643 q 237 718 136 718 q 273 716 256 718 q 309 709 290 714 q 350 696 328 705 q 405 674 373 688 q 449 656 430 664 q 483 645 468 649 q 513 639 499 641 q 541 637 527 637 q 581 644 560 637 q 621 661 601 650 q 660 687 641 672 q 696 719 679 702 l 696 609 q 527 536 630 536 q 491 537 508 536 q 455 543 474 539 q 414 556 436 548 q 359 578 391 565 "},"ΐ":{"x_min":-19,"x_max":428,"ha":454,"o":"m 234 743 l 234 220 q 255 121 234 154 q 326 88 277 88 q 353 89 338 88 q 383 93 368 91 q 409 97 397 95 q 428 102 421 100 l 428 8 q 405 0 419 3 q 375 -7 391 -4 q 341 -12 358 -10 q 307 -14 323 -14 q 229 -3 265 -14 q 167 34 193 7 q 125 105 140 60 q 111 219 111 150 l 111 743 l 234 743 m 140 959 q 155 1005 147 980 q 172 1057 164 1030 q 187 1112 180 1084 q 200 1164 195 1139 l 341 1164 l 341 1150 q 312 1102 328 1128 q 277 1049 296 1076 q 237 994 258 1022 q 195 942 217 967 l 140 942 l 140 959 m -19 945 q -4 998 -19 982 q 30 1015 9 1015 q 48 1010 39 1015 q 64 998 57 1006 q 74 977 70 989 q 78 945 78 964 q 63 892 78 909 q 30 876 49 876 q -4 892 9 876 q -19 945 -19 909 m 310 945 q 324 998 310 982 q 359 1015 338 1015 q 377 1010 368 1015 q 393 998 386 1006 q 403 977 399 989 q 408 945 408 964 q 393 892 408 909 q 359 876 378 876 q 324 892 338 876 q 310 945 310 909 "},"ĸ":{"x_min":118,"x_max":684.25,"ha":689,"o":"m 545 0 l 315 331 l 241 276 l 241 0 l 118 0 l 118 745 l 241 745 l 241 554 q 239 479 241 513 q 236 418 238 444 q 230 364 233 388 l 319 483 l 526 745 l 665 745 l 394 412 l 684 0 l 545 0 "},"g":{"x_min":25,"x_max":692.484375,"ha":720,"o":"m 692 745 l 692 668 l 559 649 q 591 588 578 625 q 604 504 604 551 q 588 409 604 453 q 539 333 572 365 q 459 283 507 301 q 348 266 412 266 q 319 266 333 266 q 294 268 304 266 q 271 253 282 261 q 251 233 260 244 q 236 208 242 222 q 230 178 230 194 q 238 148 230 159 q 260 130 246 136 q 293 122 274 124 q 333 120 312 120 l 453 120 q 560 104 516 120 q 631 61 603 88 q 670 -2 658 34 q 683 -80 683 -38 q 660 -186 683 -139 q 593 -266 638 -233 q 478 -316 547 -298 q 314 -334 408 -334 q 187 -319 241 -334 q 96 -278 132 -305 q 42 -213 60 -251 q 25 -128 25 -175 q 38 -57 25 -87 q 73 -4 51 -26 q 125 32 96 17 q 187 53 155 46 q 140 94 158 66 q 122 159 122 122 q 143 231 122 201 q 212 291 165 262 q 158 324 182 303 q 118 373 134 346 q 92 433 101 401 q 83 500 83 466 q 99 608 83 561 q 150 689 116 656 q 233 740 183 722 q 348 758 282 758 q 400 754 373 758 q 445 745 427 750 l 692 745 m 141 -126 q 150 -173 141 -151 q 179 -211 159 -195 q 232 -235 199 -226 q 314 -245 265 -245 q 503 -205 440 -245 q 566 -92 566 -166 q 558 -41 566 -61 q 531 -10 550 -21 q 482 4 512 0 q 407 8 451 8 l 287 8 q 238 3 263 8 q 190 -17 212 -2 q 155 -58 169 -32 q 141 -126 141 -84 m 206 504 q 242 388 206 426 q 344 350 278 350 q 446 388 411 350 q 480 506 480 426 q 445 629 480 590 q 343 669 410 669 q 241 628 277 669 q 206 504 206 587 "},"ǿ":{"x_min":78,"x_max":727,"ha":802,"o":"m 727 373 q 704 208 727 280 q 639 86 681 135 q 536 11 596 37 q 400 -14 475 -14 q 249 21 315 -14 l 202 -52 l 113 -1 l 168 87 q 101 208 125 135 q 78 373 78 280 q 100 537 78 465 q 165 657 123 608 q 268 732 207 707 q 404 758 329 758 q 485 748 447 758 q 557 719 524 738 l 603 793 l 692 743 l 638 655 q 703 535 680 606 q 727 373 727 464 m 205 373 q 211 271 205 316 q 233 192 218 227 l 503 631 q 457 649 483 643 q 401 655 432 655 q 251 585 297 655 q 205 373 205 515 m 599 373 q 573 548 599 481 l 302 110 q 348 93 323 99 q 403 88 372 88 q 553 159 507 88 q 599 373 599 231 m 321 860 q 351 905 335 879 q 383 958 367 931 q 414 1013 399 986 q 439 1064 428 1040 l 588 1064 l 588 1049 q 555 1004 577 1031 q 508 946 534 976 q 454 889 482 917 q 403 842 426 860 l 321 842 l 321 860 "},"²":{"x_min":33,"x_max":421.734375,"ha":460,"o":"m 421 397 l 33 397 l 33 472 l 175 627 q 238 697 214 669 q 277 749 263 726 q 295 791 290 771 q 301 834 301 811 q 278 899 301 878 q 219 920 255 920 q 152 903 184 920 q 90 860 120 886 l 37 924 q 118 981 73 958 q 219 1004 164 1004 q 293 992 260 1004 q 349 960 326 981 q 385 907 372 938 q 398 837 398 876 q 387 774 398 803 q 356 715 376 744 q 307 655 336 686 q 239 587 277 624 l 129 480 l 421 480 l 421 397 "},"Ã":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 523 1072 q 469 1083 496 1072 q 417 1110 443 1095 q 367 1136 391 1124 q 322 1148 343 1148 q 275 1130 291 1148 q 249 1070 259 1112 l 179 1070 q 193 1144 182 1111 q 222 1201 204 1177 q 265 1237 240 1224 q 322 1250 290 1250 q 378 1238 350 1250 q 431 1211 405 1226 q 480 1185 457 1197 q 523 1173 504 1173 q 569 1191 554 1173 q 595 1251 585 1209 l 667 1251 q 652 1177 663 1210 q 623 1121 641 1144 q 580 1084 605 1097 q 523 1072 555 1072 "},"Ј":{"x_min":-125,"x_max":251.15625,"ha":376,"o":"m -19 -264 q -80 -259 -54 -264 q -125 -247 -106 -255 l -125 -139 q -75 -149 -101 -145 q -18 -152 -48 -152 q 32 -146 6 -152 q 78 -122 57 -139 q 112 -76 99 -105 q 125 0 125 -46 l 125 992 l 251 992 l 251 13 q 231 -109 251 -57 q 175 -196 211 -162 q 90 -247 140 -230 q -19 -264 40 -264 "},"©":{"x_min":68,"x_max":1088,"ha":1156,"o":"m 604 713 q 531 698 563 713 q 477 655 499 683 q 444 587 455 627 q 433 495 433 546 q 443 402 433 443 q 473 334 453 361 q 526 291 494 306 q 604 277 559 277 q 638 279 620 277 q 676 286 657 281 q 714 295 695 290 q 751 307 734 301 l 751 218 q 718 205 734 211 q 683 194 701 199 q 645 187 665 189 q 600 185 624 185 q 479 207 531 185 q 393 271 428 229 q 342 370 359 312 q 325 497 325 427 q 343 622 325 566 q 397 719 361 679 q 484 783 432 760 q 604 806 536 806 q 692 794 647 806 q 777 763 736 783 l 734 677 q 666 704 699 694 q 604 713 633 713 m 68 495 q 86 631 68 566 q 137 753 104 696 q 217 856 170 809 q 320 936 264 903 q 442 987 377 969 q 578 1006 507 1006 q 713 987 648 1006 q 835 936 778 969 q 938 856 892 903 q 1018 753 985 809 q 1069 631 1051 696 q 1088 495 1088 566 q 1069 359 1088 425 q 1018 238 1051 294 q 938 134 985 181 q 835 55 892 88 q 713 3 778 21 q 578 -14 648 -14 q 442 3 507 -14 q 320 55 377 21 q 217 134 264 88 q 137 238 170 181 q 86 359 104 294 q 68 495 68 425 m 141 496 q 176 326 141 405 q 269 187 210 247 q 408 94 329 128 q 578 59 487 59 q 747 94 668 59 q 886 187 826 128 q 979 326 945 247 q 1014 496 1014 405 q 979 665 1014 586 q 886 804 945 744 q 747 897 826 863 q 578 932 668 932 q 408 897 487 932 q 269 804 329 863 q 176 665 210 744 q 141 496 141 586 "},"≥":{"x_min":69,"x_max":696,"ha":765,"o":"m 69 270 l 569 488 l 69 734 l 69 844 l 696 517 l 696 448 l 69 161 l 69 270 m 69 0 l 69 101 l 696 101 l 696 0 l 69 0 "},"Ă":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 626 1259 q 608 1183 623 1217 q 567 1123 593 1149 q 504 1084 541 1098 q 419 1071 467 1071 q 332 1084 369 1071 q 271 1122 295 1097 q 233 1181 246 1147 q 218 1259 220 1216 l 292 1259 q 304 1212 295 1229 q 330 1186 314 1194 q 369 1175 346 1177 q 422 1172 392 1172 q 468 1175 446 1172 q 508 1188 490 1178 q 537 1214 525 1197 q 551 1259 548 1231 l 626 1259 "},"ґ":{"x_min":118,"x_max":527,"ha":555,"o":"m 527 656 l 241 656 l 241 0 l 118 0 l 118 745 l 403 745 l 403 961 l 527 961 l 527 656 "},"ÿ":{"x_min":6.75,"x_max":672.25,"ha":679,"o":"m 6 745 l 134 745 l 280 329 q 300 272 290 301 q 318 212 310 242 q 333 154 327 182 q 341 103 339 126 l 346 103 q 356 149 349 120 q 373 211 364 178 q 392 276 382 244 q 409 330 402 308 l 544 745 l 672 745 l 377 -96 q 336 -195 358 -152 q 285 -270 314 -239 q 217 -317 256 -300 q 123 -334 177 -334 q 62 -330 88 -334 q 18 -322 36 -326 l 18 -223 q 54 -229 32 -226 q 99 -231 75 -231 q 156 -223 132 -231 q 197 -201 179 -216 q 227 -164 215 -186 q 250 -115 240 -142 l 289 -6 l 6 745 m 155 945 q 173 998 155 982 q 220 1015 192 1015 q 266 998 246 1015 q 285 945 285 981 q 266 892 285 909 q 220 876 246 876 q 173 892 192 876 q 155 945 155 909 m 409 945 q 428 998 409 982 q 474 1015 447 1015 q 499 1010 487 1015 q 520 998 511 1006 q 534 977 529 989 q 540 945 540 964 q 520 892 540 909 q 474 876 500 876 q 428 892 447 876 q 409 945 409 909 "},"Ł":{"x_min":20,"x_max":649.4375,"ha":682,"o":"m 135 458 l 135 992 l 261 992 l 261 537 l 415 635 l 468 550 l 261 420 l 261 111 l 649 111 l 649 0 l 135 0 l 135 341 l 69 301 l 20 385 l 135 458 "}," ":{"x_min":0,"x_max":0,"ha":372},"∫":{"x_min":10.578125,"x_max":524.65625,"ha":538,"o":"m 435 1055 q 484 1051 458 1055 q 524 1042 509 1048 l 524 944 q 491 956 512 950 q 446 962 471 962 q 389 948 412 962 q 354 913 367 935 q 335 862 340 891 q 330 803 330 834 l 330 -92 q 313 -202 330 -156 q 265 -276 296 -247 q 193 -320 235 -306 q 101 -334 151 -334 q 51 -330 77 -334 q 10 -321 26 -326 l 10 -224 q 45 -235 24 -230 q 89 -241 66 -241 q 147 -228 124 -241 q 185 -194 171 -215 q 205 -143 199 -172 q 212 -82 212 -115 l 212 814 q 227 923 212 878 q 273 998 243 969 q 343 1041 302 1027 q 435 1055 384 1055 "},"\\":{"x_min":15.75,"x_max":505.375,"ha":518,"o":"m 136 992 l 505 0 l 384 0 l 15 992 l 136 992 "},"Ì":{"x_min":42,"x_max":414.8125,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 309 1071 l 227 1071 q 175 1118 203 1089 q 121 1175 147 1146 q 74 1233 95 1205 q 42 1278 52 1260 l 42 1293 l 190 1293 q 216 1242 201 1269 q 246 1187 230 1215 q 278 1134 262 1160 q 309 1089 294 1108 l 309 1071 "},"ъ":{"x_min":28,"x_max":865,"ha":942,"o":"m 395 439 l 582 439 q 795 386 726 439 q 865 227 865 333 q 849 133 865 175 q 798 61 833 91 q 710 15 764 31 q 580 0 656 0 l 272 0 l 272 642 l 28 642 l 28 745 l 395 745 l 395 439 m 741 219 q 730 275 741 252 q 697 311 719 297 q 643 330 675 325 q 567 336 610 336 l 395 336 l 395 102 l 570 102 q 638 108 607 102 q 693 127 670 113 q 728 164 715 141 q 741 219 741 186 "},"ς":{"x_min":77,"x_max":596,"ha":632,"o":"m 204 351 q 213 245 204 286 q 248 177 223 204 q 315 135 272 151 q 424 104 358 119 q 504 78 472 94 q 556 42 536 62 q 584 -1 576 22 q 593 -54 593 -25 q 585 -114 593 -84 q 567 -172 578 -144 q 541 -225 555 -200 q 511 -272 526 -250 l 396 -272 q 426 -225 412 -250 q 451 -177 440 -201 q 469 -129 463 -152 q 476 -87 476 -107 q 471 -61 476 -74 q 450 -37 466 -48 q 403 -15 434 -25 q 321 5 373 -4 q 224 37 269 15 q 147 99 180 59 q 95 200 114 139 q 77 349 77 261 q 101 530 77 454 q 170 657 126 607 q 275 733 215 708 q 408 758 336 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 315 630 354 650 q 252 573 276 611 q 216 479 227 535 q 204 351 204 423 "},"Ē":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 199 1172 l 589 1172 l 589 1071 l 199 1071 l 199 1172 "},"!":{"x_min":100,"x_max":272.265625,"ha":374,"o":"m 228 280 l 146 280 l 112 992 l 262 992 l 228 280 m 100 74 q 106 118 100 100 q 125 147 113 136 q 152 163 136 158 q 186 169 167 169 q 219 163 203 169 q 247 147 235 158 q 265 118 258 136 q 272 74 272 100 q 265 31 272 49 q 247 2 258 13 q 219 -14 235 -9 q 186 -20 203 -20 q 152 -14 167 -20 q 125 2 136 -9 q 106 31 113 13 q 100 74 100 49 "},"ç":{"x_min":77,"x_max":596,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 253 581 302 650 q 204 369 204 513 q 253 160 204 226 q 402 93 302 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 m 495 -194 q 447 -297 495 -260 q 297 -334 399 -334 q 267 -331 282 -334 q 242 -327 252 -329 l 242 -254 q 268 -257 252 -256 q 295 -258 285 -258 q 370 -247 343 -258 q 397 -208 397 -235 q 388 -186 397 -195 q 364 -169 379 -176 q 327 -157 349 -162 q 282 -147 306 -152 l 343 0 l 425 0 l 386 -78 q 429 -92 409 -83 q 463 -115 448 -101 q 486 -148 478 -128 q 495 -194 495 -168 "},"Й":{"x_min":136,"x_max":879,"ha":1013,"o":"m 136 992 l 262 992 l 262 449 q 261 410 262 431 q 260 366 261 389 q 259 321 260 343 q 257 276 258 298 q 251 174 254 226 l 256 174 l 725 992 l 879 992 l 879 0 l 752 0 l 752 538 q 754 624 752 576 q 759 717 756 673 q 765 821 762 768 l 760 821 l 289 0 l 136 0 l 136 992 m 754 1287 q 733 1193 749 1234 q 685 1126 716 1153 q 605 1084 653 1098 q 489 1071 557 1071 q 372 1084 420 1071 q 295 1124 324 1097 q 251 1192 265 1151 q 234 1287 237 1232 l 349 1287 q 361 1219 352 1245 q 388 1178 371 1193 q 430 1158 405 1163 q 492 1152 456 1152 q 547 1159 522 1152 q 590 1181 572 1166 q 620 1222 608 1197 q 635 1287 631 1248 l 754 1287 "},"Б":{"x_min":135,"x_max":729,"ha":800,"o":"m 729 290 q 708 170 729 224 q 645 79 688 117 q 537 20 602 41 q 380 0 471 0 l 135 0 l 135 992 l 669 992 l 669 880 l 261 880 l 261 574 l 362 574 q 536 551 465 574 q 648 490 606 529 q 710 400 691 452 q 729 290 729 349 m 261 107 l 368 107 q 540 152 485 107 q 595 290 595 197 q 579 370 595 337 q 533 424 564 403 q 456 453 503 444 q 347 462 410 462 l 261 462 l 261 107 "},"đ":{"x_min":77,"x_max":801.796875,"ha":814,"o":"m 577 99 l 572 99 q 537 55 557 76 q 491 19 517 34 q 432 -5 465 3 q 359 -14 400 -14 q 244 9 296 -14 q 154 80 192 33 q 97 196 117 127 q 77 356 77 265 q 97 517 77 447 q 154 634 117 587 q 244 705 192 681 q 359 730 296 730 q 432 721 399 730 q 490 698 464 713 q 537 663 516 683 q 572 622 557 643 l 580 622 q 576 666 578 645 q 573 703 575 684 q 572 733 572 722 l 572 843 l 316 843 l 316 932 l 572 932 l 572 1055 l 696 1055 l 696 932 l 801 932 l 801 843 l 696 843 l 696 0 l 596 0 l 577 99 m 383 88 q 470 103 434 88 q 528 148 506 118 q 560 223 550 178 q 572 329 571 268 l 572 356 q 563 472 572 422 q 532 557 554 523 q 473 609 510 592 q 382 627 437 627 q 247 557 290 627 q 204 354 204 487 q 247 154 204 220 q 383 88 290 88 "},"ċ":{"x_min":77,"x_max":596,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 253 581 302 650 q 204 369 204 513 q 253 160 204 226 q 402 93 302 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 m 317 945 q 337 1004 317 986 q 388 1023 358 1023 q 417 1018 403 1023 q 440 1004 430 1014 q 455 980 449 995 q 461 945 461 966 q 440 887 461 906 q 388 868 418 868 q 337 886 358 868 q 317 945 317 905 "},"Ā":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 227 1172 l 617 1172 l 617 1071 l 227 1071 l 227 1172 "},"Ẃ":{"x_min":13.75,"x_max":1214.25,"ha":1228,"o":"m 549 992 l 682 992 l 837 411 q 857 335 847 373 q 876 261 867 297 q 891 194 884 225 q 901 136 897 162 q 908 192 904 162 q 917 256 912 223 q 929 325 923 290 q 943 393 936 360 l 1079 992 l 1214 992 l 965 0 l 837 0 l 665 636 q 647 707 656 671 q 631 776 638 744 q 615 848 622 813 q 600 776 608 814 q 585 707 593 745 q 567 632 576 669 l 402 0 l 275 0 l 13 992 l 147 992 l 298 388 q 313 323 306 357 q 325 257 320 290 q 336 192 331 223 q 344 136 341 162 q 352 194 347 161 q 364 264 358 227 q 379 338 371 301 q 396 409 387 376 l 549 992 m 549 1089 q 579 1134 563 1108 q 611 1187 595 1160 q 642 1242 627 1215 q 667 1293 656 1269 l 816 1293 l 816 1278 q 783 1233 805 1260 q 736 1175 762 1205 q 682 1118 710 1146 q 631 1071 654 1089 l 549 1071 l 549 1089 "},"ø":{"x_min":78,"x_max":727,"ha":802,"o":"m 727 373 q 704 208 727 280 q 639 86 681 135 q 536 11 596 37 q 400 -14 475 -14 q 249 21 315 -14 l 202 -52 l 113 -1 l 168 87 q 101 208 125 135 q 78 373 78 280 q 100 537 78 465 q 165 657 123 608 q 268 732 207 707 q 404 758 329 758 q 485 748 447 758 q 557 719 524 738 l 603 793 l 692 743 l 638 655 q 703 535 680 606 q 727 373 727 464 m 205 373 q 211 271 205 316 q 233 192 218 227 l 503 631 q 457 649 483 643 q 401 655 432 655 q 251 585 297 655 q 205 373 205 515 m 599 373 q 573 548 599 481 l 302 110 q 348 93 323 99 q 403 88 372 88 q 553 159 507 88 q 599 373 599 231 "},"â":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 605 842 l 523 842 q 451 897 488 864 q 380 967 415 930 q 307 897 343 930 q 237 842 271 864 l 155 842 l 155 860 q 195 905 172 879 q 241 958 218 931 q 284 1013 264 986 q 314 1064 304 1040 l 445 1064 q 475 1013 455 1040 q 518 958 495 986 q 564 905 541 931 q 605 860 588 879 l 605 842 "},"}":{"x_min":36,"x_max":451,"ha":492,"o":"m 153 214 q 193 328 153 286 q 311 383 233 369 l 311 391 q 193 446 233 405 q 153 559 153 488 l 153 783 q 145 836 153 815 q 122 868 137 857 q 84 885 106 880 q 36 890 63 889 l 36 992 q 132 980 87 991 q 208 944 176 968 q 258 883 240 920 q 277 793 277 846 l 277 567 q 288 507 277 531 q 321 467 299 483 q 376 445 343 452 q 451 439 408 439 l 451 337 q 321 307 366 337 q 277 208 277 278 l 277 -19 q 258 -110 277 -73 q 208 -172 240 -148 q 132 -208 176 -196 q 36 -220 87 -219 l 36 -118 q 84 -113 63 -117 q 122 -96 106 -108 q 145 -64 137 -84 q 153 -10 153 -43 l 153 214 "},"Δ":{"x_min":25,"x_max":765,"ha":789,"o":"m 765 84 l 765 0 l 25 0 l 25 90 l 330 992 l 457 992 l 765 84 m 393 852 q 367 745 381 802 q 333 626 352 688 l 158 111 l 631 111 l 457 622 q 419 745 435 688 q 393 852 403 802 "},"‰":{"x_min":69,"x_max":1555,"ha":1624,"o":"m 169 695 q 193 527 169 583 q 271 471 217 471 q 377 695 377 471 q 271 917 377 917 q 193 862 217 917 q 169 695 169 807 m 478 695 q 465 564 478 622 q 428 465 453 505 q 364 404 403 425 q 271 383 325 383 q 184 404 222 383 q 120 465 146 425 q 81 564 94 505 q 69 695 69 622 q 80 826 69 769 q 117 924 92 884 q 180 984 142 963 q 271 1006 218 1006 q 360 984 322 1006 q 425 924 399 963 q 464 826 451 884 q 478 695 478 769 m 769 297 q 793 129 769 185 q 871 74 817 74 q 976 297 976 74 q 871 519 976 519 q 793 464 817 519 q 769 297 769 409 m 1077 298 q 1065 166 1077 224 q 1028 68 1053 108 q 964 7 1003 28 q 871 -14 925 -14 q 783 7 821 -14 q 720 68 745 28 q 681 166 694 108 q 669 298 669 224 q 680 428 669 371 q 717 526 692 486 q 780 586 742 565 q 871 608 818 608 q 960 586 922 608 q 1024 526 999 565 q 1063 428 1050 486 q 1077 298 1077 371 m 903 992 l 352 0 l 245 0 l 796 992 l 903 992 m 1247 297 q 1271 129 1247 185 q 1349 74 1295 74 q 1454 297 1454 74 q 1349 519 1454 519 q 1271 464 1295 519 q 1247 297 1247 409 m 1555 298 q 1543 166 1555 224 q 1506 68 1531 108 q 1442 7 1481 28 q 1349 -14 1403 -14 q 1261 7 1299 -14 q 1198 68 1223 28 q 1159 166 1172 108 q 1147 298 1147 224 q 1158 428 1147 371 q 1195 526 1170 486 q 1258 586 1220 565 q 1349 608 1296 608 q 1438 586 1399 608 q 1502 526 1477 565 q 1541 428 1528 486 q 1555 298 1555 371 "},"Ä":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 m 230 1174 q 248 1227 230 1211 q 295 1244 267 1244 q 341 1227 321 1244 q 360 1174 360 1210 q 341 1121 360 1138 q 295 1105 321 1105 q 248 1121 267 1105 q 230 1174 230 1138 m 484 1174 q 503 1227 484 1211 q 549 1244 522 1244 q 574 1239 562 1244 q 595 1227 586 1235 q 609 1206 604 1218 q 615 1174 615 1193 q 595 1121 615 1138 q 549 1105 575 1105 q 503 1121 522 1105 q 484 1174 484 1138 "},"ř":{"x_min":78,"x_max":528,"ha":554,"o":"m 439 758 q 483 756 459 758 q 526 751 508 754 l 509 637 q 470 643 490 640 q 433 645 450 645 q 355 628 390 645 q 294 578 320 610 q 255 501 269 546 q 241 401 241 456 l 241 0 l 118 0 l 118 745 l 218 745 l 233 608 l 238 608 q 274 664 255 637 q 318 712 294 691 q 372 745 342 732 q 439 758 402 758 m 528 1045 q 487 1000 511 1026 q 441 947 464 974 q 398 892 418 919 q 368 842 378 865 l 237 842 q 207 892 227 865 q 164 947 187 919 q 118 1000 141 974 q 78 1045 95 1026 l 78 1064 l 160 1064 q 230 1008 194 1041 q 303 937 266 975 q 374 1008 338 975 q 446 1064 411 1041 l 528 1064 l 528 1045 "},"—":{"x_min":56,"x_max":1333,"ha":1389,"o":"m 56 315 l 56 429 l 1333 429 l 1333 315 l 56 315 "},"N":{"x_min":135,"x_max":878,"ha":1013,"o":"m 878 0 l 724 0 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 757 174 l 762 174 q 757 276 759 226 q 755 321 756 298 q 753 366 754 343 q 752 410 752 389 q 751 449 751 431 l 751 992 l 878 992 l 878 0 "},"⁄":{"x_min":-239.25,"x_max":418.25,"ha":180,"o":"m 418 992 l -132 0 l -239 0 l 311 992 l 418 992 "},"2":{"x_min":65,"x_max":683.34375,"ha":765,"o":"m 683 0 l 65 0 l 65 105 l 301 364 q 392 464 352 419 q 460 553 432 510 q 503 640 488 596 q 518 736 518 684 q 507 806 518 775 q 474 857 495 836 q 423 890 452 879 q 358 900 394 900 q 242 874 294 900 q 144 808 190 849 l 75 889 q 133 935 102 913 q 200 972 164 956 q 276 996 236 987 q 360 1006 316 1006 q 478 987 425 1006 q 567 935 530 969 q 623 851 603 900 q 644 740 644 802 q 626 630 644 683 q 576 528 608 578 q 501 426 545 477 q 406 320 457 375 l 216 118 l 216 112 l 683 112 l 683 0 "},"М":{"x_min":135,"x_max":1074,"ha":1209,"o":"m 544 0 l 253 868 l 248 868 q 255 768 252 818 q 259 678 257 726 q 261 593 261 631 l 261 0 l 135 0 l 135 992 l 331 992 l 601 183 l 605 183 l 886 992 l 1074 992 l 1074 0 l 947 0 l 947 601 q 949 682 947 637 q 952 769 950 728 q 957 867 955 817 l 951 867 l 648 0 l 544 0 "},"Ó":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 441 1089 q 471 1134 455 1108 q 503 1187 487 1160 q 534 1242 519 1215 q 559 1293 548 1269 l 708 1293 l 708 1278 q 675 1233 697 1260 q 628 1175 654 1205 q 574 1118 602 1146 q 523 1071 546 1089 l 441 1071 l 441 1089 "},"˜":{"x_min":175,"x_max":663,"ha":802,"o":"m 519 843 q 465 854 492 843 q 413 881 439 866 q 363 907 387 895 q 318 919 339 919 q 271 901 287 919 q 245 841 255 883 l 175 841 q 189 915 178 882 q 218 972 200 948 q 261 1008 236 995 q 318 1021 286 1021 q 374 1009 346 1021 q 427 982 401 997 q 476 956 453 968 q 519 944 500 944 q 565 962 550 944 q 591 1022 581 980 l 663 1022 q 648 948 659 981 q 619 892 637 915 q 576 855 601 868 q 519 843 551 843 "}," ":{"x_min":0,"x_max":0,"ha":695},"ˇ":{"x_min":175,"x_max":625,"ha":802,"o":"m 625 1045 q 584 1000 608 1026 q 538 947 561 974 q 495 892 515 919 q 465 842 475 865 l 334 842 q 304 892 324 865 q 261 947 284 919 q 215 1000 238 974 q 175 1045 192 1026 l 175 1064 l 257 1064 q 327 1008 291 1041 q 400 937 363 975 q 471 1008 435 975 q 543 1064 508 1041 l 625 1064 l 625 1045 "},"ų":{"x_min":111,"x_max":710,"ha":818,"o":"m 600 0 l 582 99 l 575 99 q 534 48 558 70 q 483 13 511 27 q 424 -7 455 0 q 360 -14 393 -14 q 252 1 299 -14 q 174 50 205 17 q 126 135 142 83 q 111 258 111 186 l 111 745 l 234 745 l 234 264 q 270 132 234 176 q 381 88 306 88 q 474 106 436 88 q 534 158 511 123 q 566 242 556 192 q 576 357 576 292 l 576 745 l 700 745 l 700 0 l 600 0 m 591 -161 q 609 -206 591 -191 q 651 -220 627 -220 q 684 -218 668 -220 q 710 -214 700 -217 l 710 -291 q 670 -299 692 -296 q 629 -302 649 -302 q 527 -266 561 -302 q 494 -170 494 -231 q 503 -116 494 -142 q 529 -69 513 -91 q 562 -30 544 -48 q 598 0 581 -12 l 685 0 q 591 -161 591 -90 "},"Ў":{"x_min":16.75,"x_max":813.25,"ha":813,"o":"m 813 992 l 522 289 q 468 172 496 227 q 402 75 440 116 q 311 10 364 34 q 183 -14 258 -14 q 117 -8 148 -14 q 62 6 87 -3 l 62 131 q 117 106 87 116 q 183 97 147 97 q 246 105 219 97 q 297 130 274 112 q 338 178 319 149 q 376 250 357 207 l 16 992 l 155 992 l 415 440 q 422 425 418 433 q 428 408 425 417 q 434 391 431 399 q 440 377 437 383 l 441 377 q 447 394 443 383 q 455 416 451 404 q 462 437 458 427 q 468 451 466 447 l 679 992 l 813 992 m 684 1287 q 663 1193 679 1234 q 615 1126 646 1153 q 535 1084 583 1098 q 419 1071 487 1071 q 302 1084 350 1071 q 225 1124 254 1097 q 181 1192 195 1151 q 164 1287 167 1232 l 279 1287 q 291 1219 282 1245 q 318 1178 301 1193 q 360 1158 335 1163 q 422 1152 386 1152 q 477 1159 452 1152 q 520 1181 502 1166 q 550 1222 538 1197 q 565 1287 561 1248 l 684 1287 "},"Ŭ":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 689 1259 q 671 1183 686 1217 q 630 1123 656 1149 q 567 1084 604 1098 q 482 1071 530 1071 q 395 1084 432 1071 q 334 1122 358 1097 q 296 1181 309 1147 q 281 1259 283 1216 l 355 1259 q 367 1212 358 1229 q 393 1186 377 1194 q 432 1175 409 1177 q 485 1172 455 1172 q 531 1175 509 1172 q 571 1188 553 1178 q 600 1214 588 1197 q 614 1259 611 1231 l 689 1259 "},"ĝ":{"x_min":25,"x_max":692.484375,"ha":720,"o":"m 692 745 l 692 668 l 559 649 q 591 588 578 625 q 604 504 604 551 q 588 409 604 453 q 539 333 572 365 q 459 283 507 301 q 348 266 412 266 q 319 266 333 266 q 294 268 304 266 q 271 253 282 261 q 251 233 260 244 q 236 208 242 222 q 230 178 230 194 q 238 148 230 159 q 260 130 246 136 q 293 122 274 124 q 333 120 312 120 l 453 120 q 560 104 516 120 q 631 61 603 88 q 670 -2 658 34 q 683 -80 683 -38 q 660 -186 683 -139 q 593 -266 638 -233 q 478 -316 547 -298 q 314 -334 408 -334 q 187 -319 241 -334 q 96 -278 132 -305 q 42 -213 60 -251 q 25 -128 25 -175 q 38 -57 25 -87 q 73 -4 51 -26 q 125 32 96 17 q 187 53 155 46 q 140 94 158 66 q 122 159 122 122 q 143 231 122 201 q 212 291 165 262 q 158 324 182 303 q 118 373 134 346 q 92 433 101 401 q 83 500 83 466 q 99 608 83 561 q 150 689 116 656 q 233 740 183 722 q 348 758 282 758 q 400 754 373 758 q 445 745 427 750 l 692 745 m 141 -126 q 150 -173 141 -151 q 179 -211 159 -195 q 232 -235 199 -226 q 314 -245 265 -245 q 503 -205 440 -245 q 566 -92 566 -166 q 558 -41 566 -61 q 531 -10 550 -21 q 482 4 512 0 q 407 8 451 8 l 287 8 q 238 3 263 8 q 190 -17 212 -2 q 155 -58 169 -32 q 141 -126 141 -84 m 206 504 q 242 388 206 426 q 344 350 278 350 q 446 388 411 350 q 480 506 480 426 q 445 629 480 590 q 343 669 410 669 q 241 628 277 669 q 206 504 206 587 m 586 842 l 504 842 q 432 897 469 864 q 361 967 396 930 q 288 897 324 930 q 218 842 252 864 l 136 842 l 136 860 q 176 905 153 879 q 222 958 199 931 q 265 1013 245 986 q 295 1064 285 1040 l 426 1064 q 456 1013 436 1040 q 499 958 476 986 q 545 905 522 931 q 586 860 569 879 l 586 842 "},"Ω":{"x_min":53.0625,"x_max":980.9375,"ha":1031,"o":"m 517 895 q 384 872 439 895 q 292 805 328 849 q 239 699 256 762 q 222 556 222 636 q 234 425 222 488 q 273 304 246 362 q 345 194 301 246 q 455 99 390 143 l 455 0 l 53 0 l 53 111 l 321 111 q 229 189 271 143 q 155 292 186 235 q 106 416 124 349 q 89 559 89 484 q 116 743 89 661 q 198 884 143 826 q 332 975 252 943 q 517 1007 412 1007 q 701 975 622 1007 q 835 884 781 943 q 917 743 890 826 q 945 559 945 661 q 927 416 945 484 q 878 292 909 349 q 805 189 847 235 q 712 111 762 143 l 980 111 l 980 0 l 579 0 l 579 99 q 688 194 643 143 q 760 304 732 246 q 799 425 787 362 q 811 556 811 488 q 794 699 811 636 q 741 805 777 762 q 649 872 705 849 q 517 895 594 895 "},"s":{"x_min":61.15625,"x_max":564,"ha":627,"o":"m 564 203 q 544 108 564 149 q 487 40 524 68 q 398 0 450 13 q 281 -14 346 -14 q 154 -2 207 -14 q 61 33 101 9 l 61 146 q 107 125 82 135 q 161 106 133 114 q 219 93 189 98 q 279 88 249 88 q 353 95 323 88 q 403 116 384 103 q 431 150 423 130 q 440 194 440 170 q 433 232 440 215 q 409 265 427 249 q 360 299 391 282 q 280 337 329 316 q 193 378 232 358 q 127 424 154 399 q 86 482 100 449 q 72 560 72 515 q 90 645 72 608 q 143 707 109 682 q 224 745 177 732 q 330 758 272 758 q 451 743 396 758 q 554 706 505 729 l 512 606 q 422 641 468 626 q 329 655 376 655 q 228 632 261 655 q 195 568 195 610 q 203 526 195 544 q 229 493 210 509 q 279 461 248 477 q 358 426 311 445 q 444 385 406 405 q 509 339 482 365 q 549 281 535 314 q 564 203 564 249 "},"?":{"x_min":25,"x_max":546,"ha":591,"o":"m 191 280 l 191 305 q 196 375 191 343 q 214 433 201 406 q 250 486 227 460 q 306 541 272 512 q 362 592 339 569 q 400 638 385 614 q 422 688 415 661 q 429 751 429 715 q 419 811 429 784 q 389 857 408 838 q 341 887 370 876 q 274 898 312 898 q 166 880 217 898 q 67 839 115 862 l 25 937 q 143 985 79 965 q 273 1006 207 1006 q 386 988 336 1006 q 472 938 437 971 q 527 858 508 906 q 546 752 546 811 q 537 671 546 707 q 512 605 529 635 q 471 546 495 574 q 412 485 446 517 q 360 432 380 455 q 328 388 339 409 q 311 344 316 366 q 307 292 307 322 l 307 280 l 191 280 m 158 74 q 164 118 158 100 q 183 147 171 136 q 210 163 194 158 q 244 169 225 169 q 277 163 261 169 q 305 147 293 158 q 323 118 316 136 q 330 74 330 100 q 323 31 330 49 q 305 2 316 13 q 277 -14 293 -9 q 244 -20 261 -20 q 210 -14 225 -20 q 183 2 194 -9 q 164 31 171 13 q 158 74 158 49 "},"Ņ":{"x_min":135,"x_max":878,"ha":1013,"o":"m 878 0 l 724 0 l 253 821 l 248 821 q 255 717 252 768 q 259 624 257 673 q 261 538 261 576 l 261 0 l 135 0 l 135 992 l 288 992 l 757 174 l 762 174 q 757 276 759 226 q 755 321 756 298 q 753 366 754 343 q 752 410 752 389 q 751 449 751 431 l 751 992 l 878 992 l 878 0 m 396 -288 q 412 -246 403 -271 q 429 -191 421 -220 q 443 -135 437 -163 q 452 -85 450 -107 l 575 -85 l 575 -98 q 560 -141 570 -115 q 534 -197 549 -167 q 500 -255 519 -226 q 462 -307 482 -284 l 396 -307 l 396 -288 "},"Ī":{"x_min":41,"x_max":431,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 41 1172 l 431 1172 l 431 1071 l 41 1071 l 41 1172 "},"Μ":{"x_min":135,"x_max":1074,"ha":1209,"o":"m 544 0 l 253 868 l 248 868 q 255 768 252 818 q 259 678 257 726 q 261 593 261 631 l 261 0 l 135 0 l 135 992 l 331 992 l 601 183 l 605 183 l 886 992 l 1074 992 l 1074 0 l 947 0 l 947 601 q 949 682 947 637 q 952 769 950 728 q 957 867 955 817 l 951 867 l 648 0 l 544 0 "},"•":{"x_min":102,"x_max":421,"ha":522,"o":"m 102 507 q 114 589 102 555 q 147 644 126 623 q 198 675 169 666 q 261 685 227 685 q 323 675 294 685 q 374 644 352 666 q 408 589 395 623 q 421 507 421 555 q 408 425 421 459 q 374 370 395 392 q 323 339 352 349 q 261 329 294 329 q 198 339 227 329 q 147 370 169 349 q 114 425 126 392 q 102 507 102 459 "},"н":{"x_min":118,"x_max":735,"ha":853,"o":"m 241 745 l 241 436 l 611 436 l 611 745 l 735 745 l 735 0 l 611 0 l 611 333 l 241 333 l 241 0 l 118 0 l 118 745 l 241 745 "},"(":{"x_min":56,"x_max":376.34375,"ha":418,"o":"m 56 380 q 68 547 56 465 q 105 708 80 630 q 168 857 130 785 q 259 992 207 928 l 376 992 q 232 704 281 861 q 183 381 183 547 q 196 221 183 301 q 232 64 208 141 q 292 -84 256 -12 q 375 -220 328 -156 l 259 -220 q 168 -89 207 -158 q 105 57 130 -19 q 68 214 80 133 q 56 380 56 296 "},"◊":{"x_min":74,"x_max":737,"ha":810,"o":"m 737 499 l 430 0 l 379 0 l 74 498 l 379 1000 l 430 1000 l 737 499 m 618 499 l 405 898 l 175 499 l 405 101 l 618 499 "},"α":{"x_min":77,"x_max":792.984375,"ha":814,"o":"m 383 88 q 470 104 434 88 q 528 153 506 120 q 560 238 550 186 q 572 360 571 289 l 572 370 q 563 492 572 439 q 532 581 554 545 q 473 636 510 618 q 382 655 437 655 q 247 581 290 655 q 204 369 204 507 q 247 157 204 227 q 383 88 290 88 m 359 -14 q 244 10 296 -14 q 154 83 192 34 q 97 203 117 131 q 77 370 77 275 q 97 538 77 466 q 156 659 118 610 q 249 733 194 708 q 372 758 304 758 q 497 729 448 758 q 579 644 546 701 l 587 644 q 605 695 594 667 q 633 745 616 723 l 730 745 q 716 687 723 722 q 705 610 710 651 q 698 527 701 569 q 696 446 696 484 l 696 162 q 712 104 696 121 q 752 87 729 87 q 775 89 762 87 q 792 93 787 91 l 792 3 q 760 -8 782 -2 q 715 -14 738 -14 q 668 -8 689 -14 q 630 10 647 -3 q 601 45 613 23 q 580 99 588 66 l 572 99 q 537 55 557 76 q 491 19 517 34 q 432 -5 465 3 q 359 -14 400 -14 "},"Ħ":{"x_min":0.03125,"x_max":973.953125,"ha":974,"o":"m 135 827 l 135 992 l 261 992 l 261 827 l 712 827 l 712 992 l 839 992 l 839 827 l 973 827 l 973 719 l 839 719 l 839 0 l 712 0 l 712 462 l 261 462 l 261 0 l 135 0 l 135 719 l 0 719 l 0 827 l 135 827 m 712 574 l 712 719 l 261 719 l 261 574 l 712 574 "},"м":{"x_min":118,"x_max":879,"ha":997,"o":"m 879 0 l 762 0 l 762 608 q 752 575 758 594 q 740 535 747 555 q 728 497 733 515 q 717 466 722 479 l 543 0 l 453 0 l 278 466 q 269 492 275 475 q 257 528 264 508 q 245 569 251 548 q 234 608 239 591 l 234 0 l 118 0 l 118 745 l 274 745 l 450 272 q 465 226 458 248 q 479 183 473 203 q 490 145 485 162 q 498 118 495 128 q 506 146 502 129 q 517 182 511 162 q 531 224 523 202 q 546 269 538 246 l 724 745 l 879 745 l 879 0 "},"з":{"x_min":45.859375,"x_max":577,"ha":639,"o":"m 250 439 q 326 445 292 439 q 385 464 360 451 q 423 499 409 477 q 436 551 436 520 q 397 629 436 603 q 284 655 357 655 q 192 642 235 655 q 96 606 148 629 l 54 706 q 107 729 81 720 q 161 745 133 739 q 219 754 189 751 q 286 758 250 758 q 393 745 344 758 q 477 707 442 732 q 533 645 513 682 q 553 561 553 608 q 543 501 553 527 q 516 455 533 475 q 475 421 499 435 q 422 398 451 407 l 422 390 q 480 366 452 381 q 529 328 508 351 q 564 275 551 306 q 577 202 577 245 q 559 117 577 157 q 504 48 541 77 q 411 2 467 19 q 278 -14 354 -14 q 144 -1 204 -14 q 45 33 85 10 l 45 146 q 92 125 66 135 q 147 106 118 114 q 209 93 176 98 q 276 88 242 88 q 346 94 313 88 q 402 114 378 100 q 439 152 425 129 q 453 210 453 176 q 408 305 453 274 q 270 336 363 336 l 184 336 l 184 439 l 250 439 "},"Ґ":{"x_min":135,"x_max":649,"ha":682,"o":"m 522 992 l 522 1196 l 649 1196 l 649 880 l 261 880 l 261 0 l 135 0 l 135 992 l 522 992 "},"Û":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 708 1071 l 626 1071 q 554 1126 591 1093 q 483 1196 518 1159 q 410 1126 446 1159 q 340 1071 374 1093 l 258 1071 l 258 1089 q 298 1134 275 1108 q 344 1187 321 1160 q 387 1242 367 1215 q 417 1293 407 1269 l 548 1293 q 578 1242 558 1269 q 621 1187 598 1215 q 667 1134 644 1160 q 708 1089 691 1108 l 708 1071 "},"і":{"x_min":108.5,"x_max":252.96875,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 108 945 q 129 1004 108 986 q 180 1023 149 1023 q 208 1018 195 1023 q 231 1004 221 1014 q 247 980 241 995 q 252 945 252 966 q 231 887 252 906 q 180 868 210 868 q 129 886 149 868 q 108 945 108 905 "},"V":{"x_min":-0.25,"x_max":789.25,"ha":789,"o":"m 654 992 l 789 992 l 457 0 l 330 0 l 0 992 l 133 992 l 333 362 q 367 243 353 301 q 393 136 381 186 q 419 243 403 186 q 455 367 434 301 l 654 992 "},"Ŗ":{"x_min":135,"x_max":803.25,"ha":819,"o":"m 261 410 l 261 0 l 135 0 l 135 992 l 376 992 q 642 922 556 992 q 729 710 729 852 q 712 607 729 651 q 668 531 695 563 q 605 479 640 500 q 533 444 570 458 l 803 0 l 654 0 l 416 410 l 261 410 m 261 517 l 371 517 q 473 529 431 517 q 543 564 516 541 q 582 623 570 588 q 595 704 595 658 q 581 787 595 753 q 540 842 567 821 q 469 874 512 864 q 368 884 426 884 l 261 884 l 261 517 m 330 -288 q 346 -246 337 -271 q 363 -191 355 -220 q 377 -135 371 -163 q 386 -85 384 -107 l 509 -85 l 509 -98 q 494 -141 504 -115 q 468 -197 483 -167 q 434 -255 453 -226 q 396 -307 416 -284 l 330 -307 l 330 -288 "},"@":{"x_min":74,"x_max":1129,"ha":1203,"o":"m 1129 496 q 1122 411 1129 453 q 1103 330 1116 369 q 1071 259 1091 292 q 1026 202 1052 226 q 967 163 1000 177 q 895 150 934 150 q 840 160 865 150 q 797 187 815 170 q 769 226 780 204 q 753 272 757 248 l 751 272 q 720 224 738 246 q 678 185 702 202 q 623 159 654 168 q 557 150 593 150 q 465 169 505 150 q 396 222 424 188 q 354 304 369 256 q 340 411 340 353 q 360 536 340 479 q 417 635 380 594 q 509 699 455 676 q 629 723 562 723 q 690 720 659 723 q 748 712 720 717 q 799 702 776 708 q 838 691 823 696 l 823 408 q 822 384 822 393 q 822 369 822 375 q 822 361 822 364 q 822 357 822 359 q 829 297 822 321 q 847 261 836 274 q 873 242 859 247 q 903 237 888 237 q 958 258 935 237 q 998 314 982 278 q 1022 396 1014 349 q 1030 497 1030 444 q 1001 668 1030 593 q 920 795 972 743 q 798 873 869 846 q 644 900 727 900 q 442 862 529 900 q 295 757 354 825 q 205 597 236 690 q 175 395 175 505 q 201 213 175 292 q 280 79 228 134 q 409 -2 332 25 q 585 -30 486 -30 q 667 -25 627 -30 q 745 -12 707 -20 q 816 6 783 -4 q 880 28 850 16 l 880 -67 q 748 -108 821 -93 q 587 -123 675 -123 q 370 -88 465 -123 q 209 12 275 -53 q 108 173 143 78 q 74 390 74 269 q 114 628 74 517 q 228 819 154 738 q 407 945 302 899 q 644 992 513 992 q 838 957 749 992 q 992 859 927 923 q 1093 703 1057 795 q 1129 496 1129 611 m 448 408 q 482 277 448 318 q 574 237 517 237 q 638 252 612 237 q 682 296 665 268 q 708 363 699 324 q 719 449 716 402 l 729 621 q 683 631 710 626 q 629 635 657 635 q 544 615 578 635 q 488 564 510 596 q 458 491 467 532 q 448 408 448 450 "},"ʼ":{"x_min":16,"x_max":228,"ha":243,"o":"m 219 992 l 228 977 q 205 898 218 939 q 176 815 192 857 q 143 731 160 772 q 108 652 125 690 l 16 652 q 38 737 26 692 q 60 827 49 782 q 79 913 70 871 q 94 992 88 956 l 219 992 "},"℅":{"x_min":96,"x_max":1016,"ha":1112,"o":"m 874 992 l 325 0 l 218 0 l 767 992 l 874 992 m 1016 227 q 1000 127 1016 170 q 958 55 985 84 q 893 10 931 25 q 809 -5 855 -5 q 729 10 766 -5 q 664 55 691 25 q 620 127 636 84 q 605 227 605 170 q 619 326 605 283 q 661 398 634 369 q 727 443 689 428 q 811 459 765 459 q 891 443 853 459 q 956 398 928 428 q 1000 326 984 369 q 1016 227 1016 283 m 705 228 q 711 164 705 193 q 729 114 716 135 q 762 82 742 93 q 811 70 782 70 q 859 82 839 70 q 891 114 879 93 q 909 164 904 135 q 915 228 915 193 q 909 291 915 263 q 891 340 904 320 q 859 372 879 361 q 811 383 839 383 q 762 372 782 383 q 729 340 742 361 q 711 291 716 320 q 705 228 705 263 m 320 534 q 233 546 274 534 q 161 587 192 559 q 113 658 131 615 q 96 763 96 702 q 113 872 96 827 q 163 945 131 917 q 236 986 194 973 q 327 999 278 999 q 395 991 362 999 q 451 973 429 984 l 429 901 q 380 916 408 910 q 328 923 351 923 q 228 884 259 923 q 196 764 196 844 q 326 609 196 609 q 390 615 360 609 q 444 631 420 620 l 444 559 q 386 540 420 546 q 320 534 353 534 "},"i":{"x_min":108.5,"x_max":252.96875,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 108 945 q 129 1004 108 986 q 180 1023 149 1023 q 208 1018 195 1023 q 231 1004 221 1014 q 247 980 241 995 q 252 945 252 966 q 231 887 252 906 q 180 868 210 868 q 129 886 149 868 q 108 945 108 905 "},"ќ":{"x_min":118,"x_max":676.25,"ha":682,"o":"m 516 745 l 649 745 l 369 387 l 676 0 l 536 0 l 241 377 l 241 0 l 118 0 l 118 745 l 241 745 l 241 383 l 516 745 m 272 860 q 302 905 286 879 q 334 958 318 931 q 365 1013 350 986 q 390 1064 379 1040 l 539 1064 l 539 1049 q 506 1004 528 1031 q 459 946 485 976 q 405 889 433 917 q 354 842 377 860 l 272 842 l 272 860 "},"≤":{"x_min":69,"x_max":696,"ha":765,"o":"m 696 161 l 69 448 l 69 517 l 696 844 l 696 735 l 197 488 l 696 270 l 696 161 m 69 0 l 69 101 l 696 101 l 696 0 l 69 0 "},"ё":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 183 945 q 201 998 183 982 q 248 1015 220 1015 q 294 998 274 1015 q 313 945 313 981 q 294 892 313 909 q 248 876 274 876 q 201 892 220 876 q 183 945 183 909 m 437 945 q 456 998 437 982 q 502 1015 475 1015 q 527 1010 515 1015 q 548 998 539 1006 q 562 977 557 989 q 568 945 568 964 q 548 892 568 909 q 502 876 528 876 q 456 892 475 876 q 437 945 437 909 "},"υ":{"x_min":111,"x_max":736,"ha":819,"o":"m 409 -14 q 264 13 322 -14 q 172 87 206 40 q 124 199 138 135 q 111 337 111 263 l 111 745 l 234 745 l 234 345 q 245 239 234 286 q 278 158 256 192 q 335 106 300 125 q 417 88 370 88 q 564 167 516 88 q 612 412 612 245 q 609 503 612 461 q 601 585 606 545 q 587 664 595 625 q 569 745 580 703 l 693 745 q 711 664 703 703 q 725 585 719 626 q 733 501 730 545 q 736 406 736 457 q 653 88 736 190 q 409 -14 570 -14 "},"ĕ":{"x_min":77,"x_max":673,"ha":743,"o":"m 412 -14 q 276 11 337 -14 q 170 84 214 36 q 101 203 125 132 q 77 366 77 274 q 99 531 77 458 q 162 654 121 604 q 259 731 202 705 q 384 758 316 758 q 505 733 451 758 q 595 665 558 709 q 653 560 633 621 q 673 423 673 498 l 673 346 l 204 346 q 259 155 207 216 q 413 93 311 93 q 477 97 448 93 q 534 107 507 100 q 587 123 561 113 q 639 145 613 133 l 639 35 q 586 13 612 22 q 533 -2 560 3 q 476 -11 505 -8 q 412 -14 446 -14 m 384 655 q 260 602 306 655 q 207 449 214 549 l 545 449 q 536 533 545 495 q 507 598 526 571 q 457 640 487 625 q 384 655 427 655 m 589 1030 q 571 954 586 988 q 530 894 556 920 q 467 855 504 869 q 382 842 430 842 q 295 855 332 842 q 234 893 258 868 q 196 952 209 918 q 181 1030 183 987 l 255 1030 q 267 983 258 1000 q 293 957 277 965 q 332 946 309 948 q 385 943 355 943 q 431 946 409 943 q 471 959 453 949 q 500 985 488 968 q 514 1030 511 1002 l 589 1030 "},"ﬃ":{"x_min":19,"x_max":1166.96875,"ha":1274,"o":"m 441 656 l 274 656 l 274 0 l 151 0 l 151 656 l 19 656 l 19 704 l 151 749 l 151 814 q 166 934 151 886 q 210 1010 181 982 q 280 1051 238 1039 q 375 1063 322 1063 q 449 1055 415 1063 q 509 1037 482 1047 l 477 941 q 431 954 456 949 q 379 960 406 960 q 332 954 352 960 q 300 931 313 947 q 280 887 287 915 q 274 815 274 859 l 274 745 l 441 745 l 441 656 m 898 656 l 731 656 l 731 0 l 608 0 l 608 656 l 476 656 l 476 704 l 608 749 l 608 814 q 623 934 608 886 q 667 1010 638 982 q 737 1051 695 1039 q 832 1063 779 1063 q 906 1055 872 1063 q 966 1037 939 1047 l 934 941 q 888 954 913 949 q 836 960 863 960 q 789 954 809 960 q 757 931 770 947 q 737 887 744 915 q 731 815 731 859 l 731 745 l 898 745 l 898 656 m 1155 0 l 1032 0 l 1032 745 l 1155 745 l 1155 0 m 1022 945 q 1043 1004 1022 986 q 1094 1023 1063 1023 q 1122 1018 1109 1023 q 1145 1004 1135 1014 q 1161 980 1155 995 q 1166 945 1166 966 q 1145 887 1166 906 q 1094 868 1124 868 q 1043 886 1063 868 q 1022 945 1022 905 "},"ż":{"x_min":56,"x_max":556.21875,"ha":612,"o":"m 556 0 l 56 0 l 56 80 l 418 656 l 78 656 l 78 745 l 544 745 l 544 650 l 189 88 l 556 88 l 556 0 m 248 945 q 268 1004 248 986 q 319 1023 289 1023 q 348 1018 334 1023 q 371 1004 361 1014 q 386 980 380 995 q 392 945 392 966 q 371 887 392 906 q 319 868 349 868 q 268 886 289 868 q 248 945 248 905 "},"Э":{"x_min":40,"x_max":740,"ha":825,"o":"m 301 894 q 186 879 237 894 q 93 841 136 863 l 40 947 q 159 991 93 976 q 299 1006 226 1006 q 491 969 409 1006 q 629 866 574 932 q 712 710 684 801 q 740 513 740 620 q 712 294 740 392 q 628 128 684 197 q 489 22 572 59 q 294 -14 405 -14 q 222 -11 255 -14 q 160 -4 189 -9 q 104 8 131 0 q 52 26 78 15 l 52 135 q 159 108 105 120 q 274 97 214 97 q 520 191 436 97 q 609 462 605 285 l 179 462 l 179 574 l 606 574 q 576 708 600 649 q 512 809 551 768 q 419 873 473 851 q 301 894 366 894 "},"ő":{"x_min":77,"x_max":725,"ha":802,"o":"m 725 373 q 702 208 725 280 q 637 86 679 135 q 534 11 594 37 q 398 -14 474 -14 q 270 11 329 -14 q 168 86 211 37 q 101 208 125 135 q 77 373 77 280 q 99 537 77 465 q 164 657 122 608 q 267 732 206 707 q 403 758 327 758 q 531 732 472 758 q 633 657 590 707 q 700 537 676 608 q 725 373 725 465 m 204 373 q 250 159 204 231 q 401 88 297 88 q 551 159 506 88 q 597 373 597 231 q 551 585 597 515 q 400 655 504 655 q 250 585 295 655 q 204 373 204 515 m 199 860 q 229 905 213 879 q 261 958 245 931 q 291 1013 277 986 q 317 1064 306 1040 l 452 1064 l 452 1049 q 419 1004 441 1031 q 372 946 398 976 q 318 889 346 917 q 267 842 291 860 l 199 842 l 199 860 m 445 860 q 475 905 459 879 q 507 958 491 931 q 537 1013 523 986 q 562 1064 552 1040 l 697 1064 l 697 1049 q 664 1004 686 1031 q 617 946 643 976 q 563 889 591 917 q 512 842 536 860 l 445 842 l 445 860 "},"Ŏ":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 720 1259 q 702 1183 717 1217 q 661 1123 687 1149 q 598 1084 635 1098 q 513 1071 561 1071 q 426 1084 463 1071 q 365 1122 389 1097 q 327 1181 340 1147 q 312 1259 314 1216 l 386 1259 q 398 1212 389 1229 q 424 1186 408 1194 q 463 1175 440 1177 q 516 1172 486 1172 q 562 1175 540 1172 q 602 1188 584 1178 q 631 1214 619 1197 q 645 1259 642 1231 l 720 1259 "},"ю":{"x_min":118,"x_max":1047,"ha":1124,"o":"m 1047 373 q 1025 208 1047 280 q 962 86 1003 135 q 864 11 922 37 q 734 -14 806 -14 q 613 8 668 -14 q 518 75 558 31 q 455 184 478 119 q 426 333 431 248 l 241 333 l 241 0 l 118 0 l 118 745 l 241 745 l 241 436 l 428 436 q 459 574 434 514 q 523 675 483 634 q 617 736 563 715 q 739 758 672 758 q 862 732 805 758 q 959 657 918 707 q 1023 537 1000 608 q 1047 373 1047 465 m 555 373 q 598 159 555 231 q 737 88 641 88 q 876 159 834 88 q 919 373 919 231 q 876 585 919 515 q 736 655 833 655 q 598 585 640 655 q 555 373 555 515 "},"İ":{"x_min":55.34375,"x_max":414.8125,"ha":471,"o":"m 414 0 l 55 0 l 55 69 l 172 96 l 172 895 l 55 922 l 55 992 l 414 992 l 414 922 l 298 895 l 298 96 l 414 69 l 414 0 m 163 1174 q 183 1233 163 1215 q 234 1252 204 1252 q 263 1247 249 1252 q 286 1233 276 1243 q 301 1209 295 1224 q 307 1174 307 1195 q 286 1116 307 1135 q 234 1097 264 1097 q 183 1115 204 1097 q 163 1174 163 1134 "},"Ě":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 620 1274 q 579 1229 603 1255 q 533 1176 556 1203 q 490 1121 510 1148 q 460 1071 470 1094 l 329 1071 q 299 1121 319 1094 q 256 1176 279 1148 q 210 1229 233 1203 q 170 1274 187 1255 l 170 1293 l 252 1293 q 322 1237 286 1270 q 395 1166 358 1204 q 466 1237 430 1204 q 538 1293 503 1270 l 620 1293 l 620 1274 "},"‹":{"x_min":55.5,"x_max":344,"ha":400,"o":"m 55 375 l 264 656 l 344 603 l 183 367 l 344 130 l 264 78 l 55 356 l 55 375 "},"ķ":{"x_min":118,"x_max":684.25,"ha":689,"o":"m 233 384 l 324 500 l 522 745 l 665 745 l 394 422 l 684 0 l 542 0 l 315 341 l 241 286 l 241 0 l 118 0 l 118 1055 l 241 1055 l 241 571 l 230 384 l 233 384 m 271 -288 q 287 -246 278 -271 q 304 -191 296 -220 q 318 -135 312 -163 q 327 -85 325 -107 l 450 -85 l 450 -98 q 435 -141 445 -115 q 409 -197 424 -167 q 375 -255 394 -226 q 337 -307 357 -284 l 271 -307 l 271 -288 "},"ì":{"x_min":-23,"x_max":244,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 m 244 842 l 162 842 q 110 889 138 860 q 56 946 82 917 q 9 1004 30 976 q -23 1049 -12 1031 l -23 1064 l 125 1064 q 151 1013 136 1040 q 181 958 165 986 q 213 905 197 931 q 244 860 229 879 l 244 842 "},"±":{"x_min":69.515625,"x_max":696.203125,"ha":765,"o":"m 332 439 l 69 439 l 69 541 l 332 541 l 332 804 l 433 804 l 433 541 l 696 541 l 696 439 l 433 439 l 433 178 l 332 178 l 332 439 m 69 0 l 69 101 l 696 101 l 696 0 l 69 0 "},"|":{"x_min":332,"x_max":433.734375,"ha":765,"o":"m 332 1055 l 433 1055 l 433 -334 l 332 -334 l 332 1055 "},"§":{"x_min":82.140625,"x_max":585,"ha":675,"o":"m 93 550 q 101 612 93 584 q 125 661 110 640 q 159 698 139 683 q 198 723 178 713 q 121 788 149 749 q 93 883 93 826 q 111 958 93 925 q 164 1014 130 991 q 245 1050 198 1037 q 351 1063 293 1063 q 470 1048 417 1063 q 572 1011 523 1034 l 534 915 q 442 947 490 934 q 346 960 394 960 q 244 941 279 960 q 209 886 209 922 q 217 852 209 868 q 245 822 226 837 q 297 791 264 807 q 377 755 329 775 q 464 714 426 736 q 529 666 503 692 q 570 606 556 639 q 585 531 585 573 q 577 467 585 496 q 555 415 569 438 q 525 376 542 392 q 489 348 508 359 q 560 285 535 322 q 585 195 585 248 q 564 110 585 147 q 508 46 544 72 q 419 6 471 20 q 301 -7 366 -7 q 175 4 228 -7 q 82 40 122 16 l 82 151 q 129 130 103 140 q 184 112 155 120 q 243 100 213 104 q 303 95 274 95 q 382 103 351 95 q 433 124 414 111 q 460 154 452 137 q 468 190 468 171 q 462 224 468 209 q 439 254 456 239 q 389 286 421 269 q 305 323 357 302 q 215 365 254 344 q 148 412 176 386 q 107 471 121 438 q 93 550 93 505 m 209 563 q 218 517 209 538 q 248 476 228 495 q 302 437 269 456 q 383 398 335 419 l 406 388 q 428 409 417 397 q 448 437 439 421 q 462 472 457 453 q 468 514 468 491 q 459 561 468 539 q 429 603 451 583 q 372 642 408 623 q 282 682 336 662 q 256 666 268 676 q 232 640 243 655 q 215 605 222 625 q 209 563 209 586 "},"џ":{"x_min":118,"x_max":706,"ha":825,"o":"m 241 102 l 582 102 l 582 745 l 706 745 l 706 0 l 479 0 l 479 -258 l 356 -258 l 356 0 l 118 0 l 118 745 l 241 745 l 241 102 "},"љ":{"x_min":11,"x_max":1054,"ha":1131,"o":"m 611 439 l 771 439 q 985 386 916 439 q 1054 227 1054 333 q 1038 133 1054 175 q 988 61 1022 91 q 900 15 954 31 q 769 0 846 0 l 488 0 l 488 642 l 351 642 q 315 342 337 466 q 259 139 293 218 q 181 25 226 61 q 75 -10 135 -10 q 39 -8 56 -10 q 11 -2 22 -6 l 11 82 q 44 78 26 78 q 111 118 81 78 q 165 241 141 158 q 205 448 188 323 q 235 745 222 574 l 611 745 l 611 439 m 930 219 q 919 275 930 252 q 886 311 908 297 q 832 330 864 325 q 756 336 799 336 l 611 336 l 611 102 l 759 102 q 828 108 796 102 q 882 127 859 113 q 917 164 904 141 q 930 219 930 186 "},"q":{"x_min":77,"x_max":696,"ha":814,"o":"m 383 88 q 470 104 434 88 q 528 151 506 119 q 560 231 550 183 q 572 342 571 279 l 572 370 q 563 492 572 439 q 532 581 554 545 q 473 636 510 618 q 382 655 437 655 q 247 581 290 655 q 204 369 204 507 q 247 157 204 227 q 383 88 290 88 m 359 -14 q 244 10 296 -14 q 154 83 192 34 q 97 203 117 131 q 77 370 77 275 q 97 538 77 466 q 154 659 117 610 q 244 733 192 708 q 359 758 296 758 q 432 748 399 758 q 490 724 464 739 q 536 688 516 709 q 572 644 556 667 l 577 644 l 596 745 l 696 745 l 696 -334 l 572 -334 l 572 -16 q 573 16 572 -3 q 576 54 575 36 q 580 99 578 76 l 572 99 q 537 55 557 76 q 491 19 517 34 q 432 -5 465 3 q 359 -14 400 -14 "},"˳":{"x_min":78,"x_max":385,"ha":463,"o":"m 385 -229 q 373 -291 385 -264 q 340 -338 361 -319 q 291 -367 319 -357 q 229 -377 262 -377 q 167 -367 195 -377 q 119 -338 139 -357 q 88 -292 99 -319 q 78 -231 78 -265 q 88 -169 78 -196 q 119 -123 99 -142 q 167 -94 139 -104 q 229 -85 195 -85 q 290 -94 262 -85 q 340 -123 319 -104 q 373 -168 361 -142 q 385 -229 385 -195 m 310 -231 q 288 -174 310 -194 q 231 -154 265 -154 q 174 -174 196 -154 q 152 -231 152 -194 q 172 -287 152 -267 q 231 -307 192 -307 q 288 -287 265 -307 q 310 -231 310 -267 "},"ή":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 -334 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 745 l 218 745 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 -334 l 583 -334 m 388 860 q 401 906 394 880 q 414 960 408 932 q 426 1014 421 987 q 435 1064 432 1041 l 570 1064 l 570 1049 q 554 1007 565 1033 q 528 951 543 980 q 495 892 512 921 q 461 842 477 863 l 388 842 l 388 860 "},"Ж":{"x_min":2.75,"x_max":1129.25,"ha":1132,"o":"m 372 511 l 12 992 l 151 992 l 505 511 l 505 992 l 631 992 l 631 511 l 980 992 l 1119 992 l 764 511 l 1129 0 l 986 0 l 631 502 l 631 0 l 505 0 l 505 502 l 145 0 l 2 0 l 372 511 "},"®":{"x_min":68,"x_max":1088,"ha":1156,"o":"m 506 521 l 554 521 q 641 545 615 521 q 668 616 668 569 q 640 686 668 666 q 553 706 612 706 l 506 706 l 506 521 m 776 617 q 767 559 776 584 q 743 513 758 533 q 709 480 728 494 q 669 458 689 467 q 749 326 714 384 q 779 277 765 301 q 804 235 793 254 q 822 205 816 216 l 829 194 l 707 194 l 569 429 l 506 429 l 506 194 l 398 194 l 398 799 l 555 799 q 723 754 669 799 q 776 617 776 710 m 68 495 q 86 631 68 566 q 137 753 104 696 q 217 856 170 809 q 320 936 264 903 q 442 987 377 969 q 578 1006 507 1006 q 713 987 648 1006 q 835 936 778 969 q 938 856 892 903 q 1018 753 985 809 q 1069 631 1051 696 q 1088 495 1088 566 q 1069 359 1088 425 q 1018 238 1051 294 q 938 134 985 181 q 835 55 892 88 q 713 3 778 21 q 578 -14 648 -14 q 442 3 507 -14 q 320 55 377 21 q 217 134 264 88 q 137 238 170 181 q 86 359 104 294 q 68 495 68 425 m 141 496 q 176 326 141 405 q 269 187 210 247 q 408 94 329 128 q 578 59 487 59 q 747 94 668 59 q 886 187 826 128 q 979 326 945 247 q 1014 496 1014 405 q 979 665 1014 586 q 886 804 945 744 q 747 897 826 863 q 578 932 668 932 q 408 897 487 932 q 269 804 329 863 q 176 665 210 744 q 141 496 141 586 "},"Н":{"x_min":135,"x_max":839,"ha":974,"o":"m 839 0 l 712 0 l 712 462 l 261 462 l 261 0 l 135 0 l 135 992 l 261 992 l 261 574 l 712 574 l 712 992 l 839 992 l 839 0 "},"Ε":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 "},"₧":{"x_min":102,"x_max":992,"ha":1042,"o":"m 908 82 q 931 84 918 82 q 955 87 943 85 q 977 92 966 89 q 992 97 987 95 l 992 6 q 948 -7 976 0 q 878 -14 921 -14 q 812 -2 842 -14 q 760 32 782 8 q 725 91 738 56 q 713 175 713 127 l 713 477 l 607 477 l 607 534 l 713 588 l 758 717 l 833 717 l 833 574 l 974 574 l 974 477 l 833 477 l 833 187 q 850 109 833 135 q 908 82 868 82 m 616 701 q 598 582 616 639 q 538 482 580 525 q 426 412 496 438 q 253 386 357 386 l 221 386 l 221 0 l 102 0 l 102 992 l 272 992 q 428 972 363 992 q 534 916 493 953 q 596 825 576 879 q 616 701 616 770 m 221 491 l 239 491 q 349 502 302 491 q 428 537 397 513 q 474 600 459 561 q 490 695 490 639 q 434 839 490 792 q 260 886 378 886 l 221 886 l 221 491 "},"л":{"x_min":11,"x_max":640,"ha":758,"o":"m 640 0 l 516 0 l 516 642 l 352 642 q 316 342 338 466 q 260 139 293 218 q 181 25 227 61 q 76 -10 136 -10 q 39 -8 56 -10 q 11 -2 22 -6 l 11 82 q 44 78 26 78 q 112 118 82 78 q 165 241 142 158 q 206 448 189 323 q 236 745 223 574 l 640 745 l 640 0 "},"σ":{"x_min":77,"x_max":784.6875,"ha":817,"o":"m 725 342 q 703 201 725 267 q 641 88 682 136 q 539 13 600 40 q 398 -14 478 -14 q 267 9 326 -14 q 165 80 207 33 q 100 196 123 127 q 77 355 77 265 q 103 535 77 461 q 178 656 129 609 q 296 723 226 702 q 453 745 366 745 l 784 745 l 784 642 l 604 642 q 651 583 629 614 q 689 514 673 551 q 715 435 706 477 q 725 342 725 393 m 204 356 q 215 249 204 298 q 250 164 226 200 q 312 108 274 128 q 401 88 349 88 q 490 107 453 88 q 551 159 527 125 q 586 238 575 192 q 597 337 597 284 q 570 508 597 435 q 493 642 543 581 l 453 642 q 341 627 388 642 q 264 578 294 612 q 219 490 233 545 q 204 356 204 435 "},"θ":{"x_min":77,"x_max":710,"ha":786,"o":"m 710 528 q 692 300 710 401 q 636 129 674 199 q 538 22 598 59 q 392 -14 477 -14 q 252 22 312 -14 q 154 129 193 59 q 95 300 114 199 q 77 528 77 401 q 94 757 77 656 q 149 927 111 857 q 246 1034 186 997 q 392 1071 306 1071 q 531 1034 472 1071 q 631 928 591 998 q 690 758 670 859 q 710 528 710 657 m 392 88 q 477 113 442 88 q 537 189 513 138 q 572 315 560 239 q 586 493 584 391 l 200 493 q 213 317 201 393 q 247 190 224 241 q 306 113 270 139 q 392 88 341 88 m 392 968 q 309 945 343 968 q 251 875 274 921 q 215 758 227 828 q 200 596 203 689 l 585 596 q 533 875 579 781 q 392 968 488 968 "}," ":{"x_min":0,"x_max":0,"ha":361},"∑":{"x_min":50,"x_max":848,"ha":876,"o":"m 50 -334 l 50 -255 l 473 364 l 60 914 l 60 992 l 804 992 l 804 880 l 237 880 l 606 365 l 222 -222 l 848 -222 l 848 -334 l 50 -334 "},"Ώ":{"x_min":-17,"x_max":1041.9375,"ha":1092,"o":"m 578 895 q 445 872 500 895 q 353 805 389 849 q 300 699 317 762 q 283 556 283 636 q 295 425 283 488 q 334 304 307 362 q 406 194 362 246 q 516 99 451 143 l 516 0 l 114 0 l 114 111 l 382 111 q 290 189 332 143 q 216 292 247 235 q 167 416 185 349 q 150 559 150 484 q 177 743 150 661 q 259 884 204 826 q 393 975 313 943 q 578 1007 473 1007 q 762 975 683 1007 q 896 884 842 943 q 978 743 951 826 q 1006 559 1006 661 q 988 416 1006 484 q 939 292 970 349 q 866 189 908 235 q 773 111 823 143 l 1041 111 l 1041 0 l 640 0 l 640 99 q 749 194 704 143 q 821 304 793 246 q 860 425 848 362 q 872 556 872 488 q 855 699 872 636 q 802 805 838 762 q 710 872 766 849 q 578 895 655 895 m -17 789 q -3 835 -10 809 q 9 889 3 861 q 21 943 16 916 q 30 993 27 970 l 165 993 l 165 978 q 149 936 160 962 q 123 880 138 909 q 90 821 107 850 q 56 771 72 792 l -17 771 l -17 789 "},"ẃ":{"x_min":13.75,"x_max":1022.25,"ha":1036,"o":"m 683 0 l 570 417 q 563 445 567 430 q 555 477 559 460 q 546 512 551 494 q 538 546 542 529 q 518 628 528 586 l 514 628 q 496 546 505 585 q 480 476 488 512 q 464 415 471 440 l 347 0 l 204 0 l 13 745 l 143 745 l 232 348 q 245 282 239 318 q 258 211 252 246 q 269 146 264 177 q 277 95 274 115 l 281 95 q 290 142 284 113 q 303 205 296 172 q 317 270 310 238 q 331 324 325 302 l 453 745 l 586 745 l 702 324 q 716 270 709 301 q 732 207 724 239 q 745 145 739 175 q 754 95 751 115 l 758 95 q 764 142 760 113 q 775 207 769 172 q 788 279 781 242 q 803 348 795 316 l 896 745 l 1022 745 l 829 0 l 683 0 m 456 860 q 486 905 470 879 q 518 958 502 931 q 549 1013 534 986 q 574 1064 563 1040 l 723 1064 l 723 1049 q 690 1004 712 1031 q 643 946 669 976 q 589 889 617 917 q 538 842 561 860 l 456 842 l 456 860 "},"+":{"x_min":69.515625,"x_max":696.203125,"ha":765,"o":"m 332 439 l 69 439 l 69 541 l 332 541 l 332 804 l 433 804 l 433 541 l 696 541 l 696 439 l 433 439 l 433 178 l 332 178 l 332 439 "},"Ë":{"x_min":135,"x_max":650,"ha":733,"o":"m 650 0 l 135 0 l 135 992 l 650 992 l 650 880 l 261 880 l 261 574 l 624 574 l 624 462 l 261 462 l 261 111 l 650 111 l 650 0 m 201 1174 q 219 1227 201 1211 q 266 1244 238 1244 q 312 1227 292 1244 q 331 1174 331 1210 q 312 1121 331 1138 q 266 1105 292 1105 q 219 1121 238 1105 q 201 1174 201 1138 m 455 1174 q 474 1227 455 1211 q 520 1244 493 1244 q 545 1239 533 1244 q 566 1227 557 1235 q 580 1206 575 1218 q 586 1174 586 1193 q 566 1121 586 1138 q 520 1105 546 1105 q 474 1121 493 1105 q 455 1174 455 1138 "},"Š":{"x_min":70.109375,"x_max":657,"ha":721,"o":"m 657 264 q 633 147 657 199 q 566 59 610 95 q 460 4 523 23 q 320 -14 398 -14 q 179 -2 245 -14 q 70 32 114 9 l 70 153 q 122 131 93 142 q 184 112 151 120 q 251 99 216 104 q 319 93 285 93 q 479 134 427 93 q 530 252 530 176 q 521 316 530 289 q 486 366 511 343 q 420 410 461 389 q 316 456 379 431 q 212 508 256 480 q 139 572 168 537 q 96 652 110 607 q 83 754 83 697 q 104 860 83 813 q 165 939 126 907 q 259 989 205 972 q 380 1006 314 1006 q 525 990 460 1006 q 640 951 589 975 l 595 845 q 495 880 551 865 q 381 894 440 894 q 254 856 299 894 q 209 752 209 818 q 219 686 209 714 q 252 635 229 657 q 315 592 276 612 q 410 549 353 572 q 517 499 471 525 q 594 441 563 473 q 641 366 625 408 q 657 264 657 323 m 607 1274 q 566 1229 590 1255 q 520 1176 543 1203 q 477 1121 497 1148 q 447 1071 457 1094 l 316 1071 q 286 1121 306 1094 q 243 1176 266 1148 q 197 1229 220 1203 q 157 1274 174 1255 l 157 1293 l 239 1293 q 309 1237 273 1270 q 382 1166 345 1204 q 453 1237 417 1204 q 525 1293 490 1270 l 607 1293 l 607 1274 "}," ":{"x_min":0,"x_max":0,"ha":1389},"ð":{"x_min":75,"x_max":725,"ha":802,"o":"m 725 388 q 702 217 725 291 q 637 91 679 142 q 534 12 594 39 q 398 -14 473 -14 q 268 8 328 -14 q 166 73 209 30 q 99 179 123 116 q 75 323 75 242 q 96 466 75 403 q 157 571 117 528 q 254 635 197 613 q 383 658 311 658 q 504 637 452 658 q 585 577 556 617 l 591 580 q 529 725 570 660 q 427 845 488 790 l 254 742 l 204 819 l 350 907 q 294 945 323 926 q 234 981 265 964 l 281 1065 q 367 1018 325 1043 q 448 964 408 994 l 602 1058 l 653 981 l 520 902 q 603 805 566 858 q 668 689 641 752 q 710 550 695 625 q 725 388 725 475 m 597 355 q 585 429 597 393 q 550 493 574 466 q 488 538 526 521 q 400 555 451 555 q 310 540 347 555 q 248 494 272 524 q 213 420 225 464 q 202 318 202 376 q 213 224 202 267 q 249 152 225 182 q 310 104 273 121 q 400 88 348 88 q 551 155 505 88 q 597 355 597 223 "},"щ":{"x_min":118,"x_max":1197,"ha":1218,"o":"m 1197 -258 l 1073 -258 l 1073 0 l 118 0 l 118 745 l 241 745 l 241 102 l 542 102 l 542 745 l 665 745 l 665 102 l 965 102 l 965 745 l 1089 745 l 1089 102 l 1197 102 l 1197 -258 "},"℮":{"x_min":69,"x_max":789,"ha":860,"o":"m 429 -24 q 273 7 341 -24 q 161 92 206 39 q 92 215 115 146 q 69 359 69 284 q 83 480 69 426 q 124 577 98 534 q 185 651 150 620 q 259 702 219 682 q 343 733 299 723 q 429 743 386 743 q 571 716 506 743 q 685 639 637 689 q 761 518 734 589 q 789 359 789 448 l 213 359 l 213 117 q 251 86 228 100 q 300 59 273 71 q 357 40 327 47 q 420 33 388 33 q 512 44 472 33 q 585 75 553 55 q 645 125 618 96 q 696 193 672 155 l 746 165 q 693 92 721 126 q 628 31 665 58 q 542 -9 590 5 q 429 -24 493 -24 m 644 417 l 644 604 q 609 632 630 618 q 560 658 588 646 q 498 677 532 670 q 426 685 465 685 q 358 678 389 685 q 300 661 327 672 q 252 635 274 650 q 213 606 230 621 l 213 417 l 644 417 "},"Φ":{"x_min":71,"x_max":994,"ha":1065,"o":"m 468 1006 l 594 1006 l 594 884 l 643 884 q 801 852 735 884 q 910 768 867 820 q 973 649 953 716 q 994 514 994 583 q 985 429 994 472 q 959 343 977 385 q 913 264 942 301 q 844 199 885 227 q 749 155 803 171 q 626 139 694 139 l 594 139 l 594 -14 l 468 -14 l 468 139 l 436 139 q 314 155 368 139 q 220 199 260 171 q 151 264 179 227 q 105 343 122 301 q 79 429 87 385 q 71 514 71 472 q 91 649 71 583 q 154 768 112 716 q 262 852 197 820 q 418 884 328 884 l 468 884 l 468 1006 m 594 246 l 611 246 q 721 266 674 246 q 798 322 768 286 q 844 408 829 358 q 860 517 860 458 q 846 617 860 570 q 804 700 832 665 q 734 755 776 735 q 632 776 691 776 l 594 776 l 594 246 m 468 776 l 429 776 q 329 755 371 776 q 259 700 287 735 q 217 617 231 665 q 204 517 204 570 q 219 408 204 458 q 265 322 235 358 q 342 266 295 286 q 450 246 388 246 l 468 246 l 468 776 "},"ş":{"x_min":61.15625,"x_max":564,"ha":627,"o":"m 564 203 q 544 108 564 149 q 487 40 524 68 q 398 0 450 13 q 281 -14 346 -14 q 154 -2 207 -14 q 61 33 101 9 l 61 146 q 107 125 82 135 q 161 106 133 114 q 219 93 189 98 q 279 88 249 88 q 353 95 323 88 q 403 116 384 103 q 431 150 423 130 q 440 194 440 170 q 433 232 440 215 q 409 265 427 249 q 360 299 391 282 q 280 337 329 316 q 193 378 232 358 q 127 424 154 399 q 86 482 100 449 q 72 560 72 515 q 90 645 72 608 q 143 707 109 682 q 224 745 177 732 q 330 758 272 758 q 451 743 396 758 q 554 706 505 729 l 512 606 q 422 641 468 626 q 329 655 376 655 q 228 632 261 655 q 195 568 195 610 q 203 526 195 544 q 229 493 210 509 q 279 461 248 477 q 358 426 311 445 q 444 385 406 405 q 509 339 482 365 q 549 281 535 314 q 564 203 564 249 m 440 -194 q 392 -297 440 -260 q 242 -334 344 -334 q 212 -331 227 -334 q 187 -327 197 -329 l 187 -254 q 213 -257 197 -256 q 240 -258 230 -258 q 315 -247 288 -258 q 342 -208 342 -235 q 333 -186 342 -195 q 309 -169 324 -176 q 272 -157 294 -162 q 227 -147 251 -152 l 288 0 l 370 0 l 331 -78 q 374 -92 354 -83 q 408 -115 393 -101 q 431 -148 423 -128 q 440 -194 440 -168 "}," ":{"x_min":0,"x_max":0,"ha":765},"ı":{"x_min":118,"x_max":241.4375,"ha":359,"o":"m 241 0 l 118 0 l 118 745 l 241 745 l 241 0 "},"ä":{"x_min":64,"x_max":626,"ha":737,"o":"m 536 0 l 511 102 l 505 102 q 461 50 483 72 q 412 13 439 28 q 353 -7 386 0 q 278 -14 321 -14 q 193 0 232 -14 q 125 40 153 12 q 80 109 96 67 q 64 208 64 151 q 142 379 64 320 q 379 445 220 439 l 503 450 l 503 496 q 494 572 503 541 q 465 620 484 602 q 419 647 447 639 q 357 655 392 655 q 253 639 301 655 q 160 599 204 623 l 117 692 q 228 739 167 720 q 357 758 290 758 q 477 744 427 758 q 560 700 527 730 q 609 623 593 669 q 626 509 626 576 l 626 0 l 536 0 m 310 88 q 386 101 351 88 q 447 140 422 114 q 488 205 473 166 q 502 298 502 245 l 502 365 l 405 360 q 303 346 345 357 q 237 316 262 336 q 202 270 213 297 q 191 208 191 243 q 224 117 191 146 q 310 88 257 88 m 185 945 q 203 998 185 982 q 250 1015 222 1015 q 296 998 276 1015 q 315 945 315 981 q 296 892 315 909 q 250 876 276 876 q 203 892 222 876 q 185 945 185 909 m 439 945 q 458 998 439 982 q 504 1015 477 1015 q 529 1010 517 1015 q 550 998 541 1006 q 564 977 559 989 q 570 945 570 964 q 550 892 570 909 q 504 876 530 876 q 458 892 477 876 q 439 945 439 909 "},"¹":{"x_min":42,"x_max":297.984375,"ha":460,"o":"m 207 992 l 297 992 l 297 397 l 201 397 l 201 754 q 201 792 201 771 q 202 833 201 813 q 204 873 203 854 q 206 908 205 893 q 184 881 196 895 q 156 853 171 866 l 92 799 l 42 864 l 207 992 "},"W":{"x_min":13.75,"x_max":1214.25,"ha":1228,"o":"m 549 992 l 682 992 l 837 411 q 857 335 847 373 q 876 261 867 297 q 891 194 884 225 q 901 136 897 162 q 908 192 904 162 q 917 256 912 223 q 929 325 923 290 q 943 393 936 360 l 1079 992 l 1214 992 l 965 0 l 837 0 l 665 636 q 647 707 656 671 q 631 776 638 744 q 615 848 622 813 q 600 776 608 814 q 585 707 593 745 q 567 632 576 669 l 402 0 l 275 0 l 13 992 l 147 992 l 298 388 q 313 323 306 357 q 325 257 320 290 q 336 192 331 223 q 344 136 341 162 q 352 194 347 161 q 364 264 358 227 q 379 338 371 301 q 396 409 387 376 l 549 992 "},"λ":{"x_min":-10.25,"x_max":710,"ha":710,"o":"m -10 0 l 288 729 l 252 837 q 233 887 243 864 q 208 926 222 910 q 172 952 193 943 q 122 961 152 961 q 82 959 99 961 q 52 953 65 956 l 52 1052 q 92 1060 69 1057 q 138 1064 114 1064 q 224 1049 188 1064 q 286 1005 260 1035 q 335 929 313 975 q 377 820 356 883 l 600 163 q 627 107 612 127 q 669 88 643 88 q 691 90 678 88 q 710 95 704 93 l 710 3 q 675 -9 694 -4 q 632 -14 657 -14 q 585 -8 605 -14 q 549 11 565 -2 q 521 46 533 24 q 498 99 508 68 l 406 382 q 389 437 399 405 q 370 502 379 469 q 353 564 361 534 q 343 610 346 594 l 338 610 q 312 501 330 558 q 272 389 294 443 l 117 0 l -10 0 "},">":{"x_min":69,"x_max":696,"ha":765,"o":"m 69 270 l 568 488 l 69 735 l 69 844 l 696 517 l 696 448 l 69 161 l 69 270 "},"τ":{"x_min":13,"x_max":590.296875,"ha":624,"o":"m 590 745 l 590 642 l 337 642 l 337 230 q 345 162 337 190 q 369 117 354 134 q 406 92 385 100 q 451 84 427 84 q 478 85 463 84 q 506 88 492 86 q 531 92 519 90 q 553 97 544 95 l 553 5 q 530 -2 544 1 q 502 -10 517 -6 q 468 -15 486 -13 q 432 -18 450 -18 q 349 -8 388 -18 q 279 27 309 1 q 231 99 249 54 q 214 216 214 145 l 214 642 l 13 642 l 13 691 l 103 745 l 590 745 "},"Ų":{"x_min":125,"x_max":845,"ha":970,"o":"m 845 993 l 845 349 q 822 205 845 272 q 755 90 800 139 q 641 13 709 41 q 481 -14 573 -14 q 327 12 394 -14 q 216 86 261 38 q 148 202 171 134 q 125 352 125 269 l 125 991 l 251 991 l 251 346 q 309 162 251 227 q 487 97 368 97 q 591 115 548 97 q 663 167 635 133 q 704 246 690 200 q 718 347 718 292 l 718 993 l 845 993 m 483 -161 q 501 -206 483 -191 q 543 -220 519 -220 q 576 -218 560 -220 q 602 -214 592 -217 l 602 -291 q 562 -299 584 -296 q 521 -302 541 -302 q 419 -266 453 -302 q 386 -170 386 -231 q 395 -116 386 -142 q 421 -69 405 -91 q 454 -30 436 -48 q 490 0 473 -12 l 577 0 q 483 -161 483 -90 "},"Ŵ":{"x_min":13.75,"x_max":1214.25,"ha":1228,"o":"m 549 992 l 682 992 l 837 411 q 857 335 847 373 q 876 261 867 297 q 891 194 884 225 q 901 136 897 162 q 908 192 904 162 q 917 256 912 223 q 929 325 923 290 q 943 393 936 360 l 1079 992 l 1214 992 l 965 0 l 837 0 l 665 636 q 647 707 656 671 q 631 776 638 744 q 615 848 622 813 q 600 776 608 814 q 585 707 593 745 q 567 632 576 669 l 402 0 l 275 0 l 13 992 l 147 992 l 298 388 q 313 323 306 357 q 325 257 320 290 q 336 192 331 223 q 344 136 341 162 q 352 194 347 161 q 364 264 358 227 q 379 338 371 301 q 396 409 387 376 l 549 992 m 839 1071 l 757 1071 q 685 1126 722 1093 q 614 1196 649 1159 q 541 1126 577 1159 q 471 1071 505 1093 l 389 1071 l 389 1089 q 429 1134 406 1108 q 475 1187 452 1160 q 518 1242 498 1215 q 548 1293 538 1269 l 679 1293 q 709 1242 689 1269 q 752 1187 729 1215 q 798 1134 775 1160 q 839 1089 822 1108 l 839 1071 "},"‛":{"x_min":17,"x_max":229,"ha":243,"o":"m 150 992 q 165 913 156 956 q 184 827 174 871 q 205 737 194 782 q 229 652 217 692 l 136 652 q 101 731 119 690 q 68 815 83 772 q 39 898 52 857 q 17 977 26 939 l 25 992 l 150 992 "},"Ð":{"x_min":32,"x_max":865,"ha":950,"o":"m 32 546 l 135 546 l 135 992 l 410 992 q 598 960 514 992 q 741 868 682 929 q 832 715 800 806 q 865 505 865 624 q 832 285 865 379 q 738 127 799 190 q 586 31 676 63 q 383 0 496 0 l 135 0 l 135 434 l 32 434 l 32 546 m 731 501 q 709 672 731 600 q 643 791 686 744 q 538 861 601 838 q 397 884 476 884 l 261 884 l 261 546 l 489 546 l 489 434 l 261 434 l 261 107 l 370 107 q 640 207 549 107 q 731 501 731 306 "},"Λ":{"x_min":-0.25,"x_max":789.25,"ha":789,"o":"m 789 0 l 654 0 l 455 625 q 419 748 434 691 q 393 856 403 805 q 367 748 381 805 q 333 629 353 691 l 133 0 l 0 0 l 330 992 l 457 992 l 789 0 "},"·":{"x_min":100,"x_max":272,"ha":372,"o":"m 100 490 q 106 534 100 516 q 125 563 113 552 q 152 579 136 574 q 186 585 167 585 q 219 579 203 585 q 246 563 235 574 q 265 534 258 552 q 272 490 272 516 q 265 447 272 465 q 246 418 258 430 q 219 401 235 406 q 186 396 203 396 q 152 401 167 396 q 125 418 136 406 q 106 447 113 430 q 100 490 100 465 "},"Х":{"x_min":-0.25,"x_max":760.25,"ha":760,"o":"m 760 0 l 617 0 l 376 430 l 127 0 l 0 0 l 307 518 l 20 992 l 155 992 l 380 612 l 608 992 l 737 992 l 450 522 l 760 0 "},"Υ":{"x_min":-0.25,"x_max":731.25,"ha":732,"o":"m 364 490 l 595 992 l 731 992 l 428 386 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 364 490 "},"r":{"x_min":118,"x_max":526,"ha":554,"o":"m 439 758 q 483 756 459 758 q 526 751 508 754 l 509 637 q 470 643 490 640 q 433 645 450 645 q 355 628 390 645 q 294 578 320 610 q 255 501 269 546 q 241 401 241 456 l 241 0 l 118 0 l 118 745 l 218 745 l 233 608 l 238 608 q 274 664 255 637 q 318 712 294 691 q 372 745 342 732 q 439 758 402 758 "},"ж":{"x_min":2.75,"x_max":997.25,"ha":1000,"o":"m 444 383 l 444 745 l 560 745 l 560 383 l 837 745 l 971 745 l 688 383 l 997 0 l 857 0 l 560 377 l 560 0 l 444 0 l 444 377 l 143 0 l 2 0 l 316 383 l 29 745 l 162 745 l 444 383 "},"Ø":{"x_min":85,"x_max":945,"ha":1031,"o":"m 881 985 l 819 884 q 913 719 881 817 q 945 496 945 620 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 297 34 387 -14 l 244 -51 l 151 0 l 212 99 q 115 268 146 167 q 85 498 85 369 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 635 992 580 1007 q 734 952 689 978 l 789 1038 l 881 985 m 218 497 q 234 337 218 408 q 282 213 249 266 l 675 854 q 603 884 642 874 q 517 895 565 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 811 497 q 751 773 811 671 l 359 136 q 430 107 391 117 q 515 97 468 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 "},"Ỳ":{"x_min":-0.25,"x_max":731.25,"ha":732,"o":"m 364 490 l 595 992 l 731 992 l 428 386 l 428 0 l 302 0 l 302 379 l 0 992 l 137 992 l 364 490 m 437 1071 l 355 1071 q 303 1118 331 1089 q 249 1175 275 1146 q 202 1233 223 1205 q 170 1278 180 1260 l 170 1293 l 318 1293 q 344 1242 329 1269 q 374 1187 358 1215 q 406 1134 390 1160 q 437 1089 422 1108 l 437 1071 "},"÷":{"x_min":69.65625,"x_max":696.34375,"ha":765,"o":"m 69 439 l 69 541 l 696 541 l 696 439 l 69 439 m 305 219 q 309 243 305 234 q 319 259 313 253 q 335 268 326 265 q 355 270 344 270 q 375 268 365 270 q 391 259 384 265 q 402 243 398 253 q 406 219 406 234 q 402 196 406 206 q 391 181 398 187 q 375 171 384 174 q 355 169 365 169 q 335 171 344 169 q 319 181 326 174 q 309 196 313 187 q 305 219 305 206 m 305 761 q 309 784 305 775 q 319 800 313 794 q 335 809 326 806 q 355 812 344 812 q 375 809 365 812 q 391 800 384 806 q 402 784 398 794 q 406 761 406 775 q 402 738 406 747 q 391 722 398 728 q 375 713 384 715 q 355 710 365 710 q 335 713 344 710 q 319 722 326 715 q 309 738 313 728 q 305 761 305 747 "},"с":{"x_min":77,"x_max":596,"ha":643,"o":"m 402 -14 q 274 7 334 -14 q 171 75 215 28 q 102 193 127 121 q 77 367 77 266 q 102 548 77 474 q 173 669 128 623 q 278 736 218 715 q 408 758 339 758 q 511 746 461 758 q 596 718 562 735 l 559 614 q 524 627 543 621 q 485 638 505 633 q 445 647 465 644 q 408 650 425 650 q 253 581 302 650 q 204 369 204 513 q 253 160 204 226 q 402 93 302 93 q 502 106 457 93 q 583 135 546 118 l 583 26 q 504 -3 546 6 q 402 -14 463 -14 "},"h":{"x_min":118,"x_max":707,"ha":818,"o":"m 583 0 l 583 479 q 547 611 583 567 q 436 655 512 655 q 343 637 381 655 q 283 585 306 620 q 251 501 261 551 q 241 385 241 450 l 241 0 l 118 0 l 118 1055 l 241 1055 l 241 741 l 236 644 l 242 644 q 283 694 259 673 q 334 730 306 715 q 393 751 362 744 q 457 758 424 758 q 644 693 581 758 q 707 486 707 628 l 707 0 l 583 0 "},"f":{"x_min":19,"x_max":509,"ha":457,"o":"m 441 656 l 274 656 l 274 0 l 151 0 l 151 656 l 19 656 l 19 704 l 151 749 l 151 814 q 166 934 151 886 q 210 1010 181 982 q 280 1051 238 1039 q 375 1063 322 1063 q 449 1055 415 1063 q 509 1037 482 1047 l 477 941 q 431 954 456 949 q 379 960 406 960 q 332 954 352 960 q 300 931 313 947 q 280 887 287 915 q 274 815 274 859 l 274 745 l 441 745 l 441 656 "},"“":{"x_min":16,"x_max":489,"ha":504,"o":"m 285 652 l 277 666 q 299 744 286 703 q 328 828 312 786 q 361 912 343 870 q 396 992 379 954 l 489 992 q 465 905 477 950 q 444 816 454 861 q 425 730 434 772 q 410 652 416 687 l 285 652 m 24 652 l 16 666 q 38 744 25 703 q 67 828 51 786 q 100 912 82 870 q 135 992 118 954 l 228 992 q 204 905 216 950 q 183 816 193 861 q 164 730 173 772 q 149 652 155 687 l 24 652 "},"A":{"x_min":-0.25,"x_max":844.25,"ha":844,"o":"m 715 0 l 606 307 l 237 307 l 127 0 l 0 0 l 364 996 l 479 996 l 844 0 l 715 0 m 566 419 l 466 706 q 456 736 462 719 q 444 774 450 754 q 432 817 438 795 q 421 860 426 839 q 410 816 416 839 q 397 773 404 794 q 386 735 391 752 q 376 706 380 718 l 277 419 l 566 419 "},"O":{"x_min":85,"x_max":945,"ha":1031,"o":"m 945 496 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 324 22 405 -14 q 189 126 243 59 q 110 288 136 193 q 85 498 85 382 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 701 970 622 1007 q 835 867 781 934 q 917 706 890 800 q 945 496 945 612 m 218 497 q 236 330 218 404 q 290 204 253 255 q 382 124 326 152 q 515 97 438 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 q 794 664 811 590 q 741 789 777 738 q 649 868 705 840 q 517 895 594 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 "},"Đ":{"x_min":32,"x_max":865,"ha":950,"o":"m 32 546 l 135 546 l 135 992 l 410 992 q 598 960 514 992 q 741 868 682 929 q 832 715 800 806 q 865 505 865 624 q 832 285 865 379 q 738 127 799 190 q 586 31 676 63 q 383 0 496 0 l 135 0 l 135 434 l 32 434 l 32 546 m 731 501 q 709 672 731 600 q 643 791 686 744 q 538 861 601 838 q 397 884 476 884 l 261 884 l 261 546 l 489 546 l 489 434 l 261 434 l 261 107 l 370 107 q 640 207 549 107 q 731 501 731 306 "},"3":{"x_min":56,"x_max":682,"ha":765,"o":"m 651 759 q 635 668 651 709 q 591 598 619 628 q 524 548 563 568 q 436 521 484 529 l 436 517 q 619 441 556 502 q 682 281 682 379 q 659 162 682 216 q 593 68 637 108 q 480 7 548 29 q 318 -14 411 -14 q 178 -2 244 -14 q 56 39 113 9 l 56 154 q 184 107 115 124 q 316 91 252 91 q 424 104 378 91 q 499 142 469 118 q 542 204 528 167 q 556 285 556 240 q 538 363 556 331 q 487 417 520 396 q 405 448 453 438 q 297 458 357 458 l 207 458 l 207 564 l 297 564 q 395 577 352 564 q 466 616 437 591 q 510 675 495 641 q 525 751 525 710 q 513 814 525 786 q 478 861 501 842 q 425 890 456 880 q 355 900 393 900 q 227 878 283 900 q 122 819 172 855 l 60 904 q 117 943 85 925 q 185 975 148 961 q 265 997 223 989 q 355 1006 307 1006 q 483 987 428 1006 q 575 936 538 969 q 632 858 613 903 q 651 759 651 812 "},"Ǿ":{"x_min":85,"x_max":945,"ha":1031,"o":"m 881 985 l 819 884 q 913 719 881 817 q 945 496 945 620 q 917 287 945 382 q 835 126 890 193 q 701 22 781 59 q 515 -14 620 -14 q 297 34 387 -14 l 244 -51 l 151 0 l 212 99 q 115 268 146 167 q 85 498 85 369 q 110 707 85 613 q 190 867 136 801 q 325 970 243 934 q 517 1007 406 1007 q 635 992 580 1007 q 734 952 689 978 l 789 1038 l 881 985 m 218 497 q 234 337 218 408 q 282 213 249 266 l 675 854 q 603 884 642 874 q 517 895 565 895 q 383 868 439 895 q 290 789 327 840 q 236 664 253 738 q 218 497 218 590 m 811 497 q 751 773 811 671 l 359 136 q 430 107 391 117 q 515 97 468 97 q 648 124 593 97 q 741 204 704 152 q 794 330 777 255 q 811 497 811 404 m 441 1089 q 471 1134 455 1108 q 503 1187 487 1160 q 534 1242 519 1215 q 559 1293 548 1269 l 708 1293 l 708 1278 q 675 1233 697 1260 q 628 1175 654 1205 q 574 1118 602 1146 q 523 1071 546 1089 l 441 1071 l 441 1089 "},"⅛":{"x_min":56,"x_max":1011,"ha":1051,"o":"m 221 992 l 311 992 l 311 397 l 215 397 l 215 754 q 215 792 215 771 q 216 833 215 813 q 218 873 217 854 q 220 908 219 893 q 198 881 210 895 q 170 853 185 866 l 106 799 l 56 864 l 221 992 m 829 992 l 278 0 l 171 0 l 722 992 l 829 992 m 815 604 q 883 594 851 604 q 938 567 914 585 q 976 519 962 548 q 991 453 991 491 q 983 407 991 428 q 962 369 976 386 q 931 338 949 352 q 893 313 914 325 q 938 285 917 300 q 975 251 959 270 q 1001 209 991 233 q 1011 157 1011 186 q 996 87 1011 119 q 956 33 982 56 q 894 0 930 11 q 816 -13 858 -13 q 670 31 721 -13 q 620 153 620 75 q 628 205 620 182 q 651 247 636 228 q 684 281 665 266 q 724 307 703 295 q 690 335 705 321 q 662 368 674 350 q 644 407 650 386 q 638 453 638 428 q 652 519 638 491 q 691 566 667 547 q 748 594 716 585 q 815 604 780 604 m 716 155 q 741 93 716 116 q 814 70 766 70 q 888 93 863 70 q 914 155 914 116 q 906 190 914 174 q 885 219 899 206 q 854 242 872 232 q 813 262 835 253 l 802 266 q 738 219 760 244 q 716 155 716 193 m 813 520 q 755 502 776 520 q 734 449 734 484 q 741 417 734 431 q 757 392 747 404 q 783 371 768 380 q 815 353 798 361 q 846 370 831 360 q 871 390 860 379 q 887 416 881 402 q 894 449 894 430 q 872 502 894 484 q 813 520 850 520 "},"4":{"x_min":16,"x_max":738,"ha":765,"o":"m 738 222 l 593 222 l 593 0 l 474 0 l 474 222 l 16 222 l 16 329 l 465 997 l 593 997 l 593 334 l 738 334 l 738 222 m 474 334 l 474 576 q 475 656 474 614 q 477 737 476 697 q 480 811 478 777 q 482 869 482 846 l 476 869 q 464 839 471 855 q 449 806 457 822 q 431 773 440 789 q 415 747 423 758 l 136 334 l 474 334 "},"Ẁ":{"x_min":13.75,"x_max":1214.25,"ha":1228,"o":"m 549 992 l 682 992 l 837 411 q 857 335 847 373 q 876 261 867 297 q 891 194 884 225 q 901 136 897 162 q 908 192 904 162 q 917 256 912 223 q 929 325 923 290 q 943 393 936 360 l 1079 992 l 1214 992 l 965 0 l 837 0 l 665 636 q 647 707 656 671 q 631 776 638 744 q 615 848 622 813 q 600 776 608 814 q 585 707 593 745 q 567 632 576 669 l 402 0 l 275 0 l 13 992 l 147 992 l 298 388 q 313 323 306 357 q 325 257 320 290 q 336 192 331 223 q 344 136 341 162 q 352 194 347 161 q 364 264 358 227 q 379 338 371 301 q 396 409 387 376 l 549 992 m 691 1071 l 609 1071 q 557 1118 585 1089 q 503 1175 529 1146 q 456 1233 477 1205 q 424 1278 434 1260 l 424 1293 l 572 1293 q 598 1242 583 1269 q 628 1187 612 1215 q 660 1134 644 1160 q 691 1089 676 1108 l 691 1071 "},"Ť":{"x_min":14,"x_max":706,"ha":721,"o":"m 423 0 l 297 0 l 297 880 l 14 880 l 14 992 l 706 992 l 706 880 l 423 880 l 423 0 m 587 1274 q 546 1229 570 1255 q 500 1176 523 1203 q 457 1121 477 1148 q 427 1071 437 1094 l 296 1071 q 266 1121 286 1094 q 223 1176 246 1148 q 177 1229 200 1203 q 137 1274 154 1255 l 137 1293 l 219 1293 q 289 1237 253 1270 q 362 1166 325 1204 q 433 1237 397 1204 q 505 1293 470 1270 l 587 1293 l 587 1274 "},"ψ":{"x_min":111,"x_max":945,"ha":1028,"o":"m 582 1054 l 582 91 q 678 118 634 97 q 754 175 722 138 q 804 264 786 211 q 821 386 821 317 q 818 478 821 434 q 811 564 816 521 q 797 651 805 606 q 778 745 789 695 l 901 745 q 920 651 912 696 q 934 564 928 607 q 942 479 939 521 q 945 390 945 436 q 915 209 945 283 q 837 87 886 134 q 721 16 787 39 q 582 -12 655 -7 l 582 -334 l 459 -334 l 459 -12 q 319 12 383 -9 q 209 80 255 34 q 136 199 162 127 q 111 376 111 272 l 111 745 l 234 745 l 234 372 q 252 242 234 294 q 301 157 271 190 q 373 109 332 124 q 459 90 414 93 l 459 1054 l 582 1054 "},"ŗ":{"x_min":65,"x_max":526,"ha":554,"o":"m 439 758 q 483 756 459 758 q 526 751 508 754 l 509 637 q 470 643 490 640 q 433 645 450 645 q 355 628 390 645 q 294 578 320 610 q 255 501 269 546 q 241 401 241 456 l 241 0 l 118 0 l 118 745 l 218 745 l 233 608 l 238 608 q 274 664 255 637 q 318 712 294 691 q 372 745 342 732 q 439 758 402 758 m 65 -288 q 81 -246 72 -271 q 98 -191 90 -220 q 112 -135 106 -163 q 121 -85 119 -107 l 244 -85 l 244 -98 q 229 -141 239 -115 q 203 -197 218 -167 q 169 -255 188 -226 q 131 -307 151 -284 l 65 -307 l 65 -288 "}},"cssFontWeight":"normal","ascender":1290,"underlinePosition":-154,"cssFontStyle":"normal","boundingBox":{"yMin":-377,"xMin":-239.25,"yMax":1363,"xMax":1555},"resolution":1000,"original_font_information":{"postscript_name":"DroidSans","version_string":"Version 1.00 build 107","vendor_url":"http://www.ascendercorp.com/","full_font_name":"Droid Sans","font_family_name":"Droid Sans","copyright":"Digitized data copyright © 2006, Google Corporation.","description":"Droid Sans is a humanist sans serif typeface designed for user interfaces and electronic communication.","trademark":"Droid is a trademark of Google and may be registered in certain jurisdictions.","designer":"","designer_url":"http://www.ascendercorp.com/typedesigners.html","unique_font_identifier":"Ascender - Droid Sans","license_url":"http://ascendercorp.com/eula10.html","license_description":"This font software is the valuable property of Ascender Corporation and/or its suppliers and its use by you is covered under the terms of a license agreement. This font software is licensed to you by Ascender Corporation for your personal or business use on up to five personal computers. You may not use this font software on more than five personal computers unless you have obtained a license from Ascender to do so. Except as specifically permitted by the license, you may not copy this font software.\n\nIf you have any questions, please review the license agreement you received with this font software, and/or contact Ascender Corporation. \n\nContact Information:\nAscender Corporation\nWeb http://www.ascendercorp.com/","manufacturer_name":"Ascender Corporation","font_sub_family_name":"Regular"},"descender":-328,"familyName":"Droid Sans","lineHeight":1617,"underlineThickness":102};

let TextFont = new THREE.Font(fontData);

/**
 * @author syt123450 / https://github.com/syt123450
 */

let TextHelper = ( function() {

	function calcOutputTextSize( cubeSize ) {

		return cubeSize;

	}

	function calcOutputTextPos( textLength, textSize, cubeSize, cubePos ) {

		return {

			x: cubePos.x - textLength * textSize / 2,
			y: cubePos.y + cubeSize,
			z: cubePos.z

		};

	}

	function calcFmTextSize( actualFmWidth ) {

		return FeatureMapTextRatio * actualFmWidth;

	}

	function calcFmHeightTextPos( textLength, textSize, actualFmWidth, fmPos ) {

		return {

			x: fmPos.x - actualFmWidth / 2 - textLength * textSize,
			y: fmPos.y,
			z: fmPos.z

		};

	}

	function calcFmWidthTextPos( textLength, textSize, actualFmHeight, fmPos ) {

		return {

			x: fmPos.x - textLength * textSize / 2,
			y: fmPos.y,
			z: fmPos.z - actualFmHeight / 2 - textSize

		};

	}

	function calcQueueTextSize( unitLength ) {

		return FeatureQueueTextRatio * unitLength;

	}

	function calcGlobalPoolingSize( unitLength ) {

		return unitLength;

	}

	function calcQueueTextPos( textLength, textSize, unitLength, queueCenter ) {

		return {

			x: queueCenter.x - textLength * textSize / 2,
			y: queueCenter.y + 2 * unitLength,
			z: queueCenter.z

		}

	}

	function calcSegmentStartIndexPos( segmentActualWidth,  textLength, textSize, queueCenter ) {

		return {

			x: queueCenter.x - segmentActualWidth / 2 - textLength * textSize - textLength * textSize / 2,
			y: queueCenter.y - textSize / 2,
			z: queueCenter.z

		};

	}

	function calcSegmentEndIndexPos( segmentActualWidth,  textLength, textSize, queueCenter ) {

		return {

			x: queueCenter.x + segmentActualWidth / 2 + textLength * textSize - textLength * textSize / 2,
			y: queueCenter.y - textSize / 2,
			z: queueCenter.z

		};

	}

	return {

		calcOutputTextPos: calcOutputTextPos,

		calcOutputTextSize: calcOutputTextSize,

		calcFmTextSize: calcFmTextSize,

		calcFmWidthTextPos: calcFmWidthTextPos,

		calcFmHeightTextPos: calcFmHeightTextPos,

		calcQueueTextSize: calcQueueTextSize,

		calcQueueTextPos: calcQueueTextPos,

		calcGlobalPoolingSize: calcGlobalPoolingSize,

		calcSegmentStartIndexPos: calcSegmentStartIndexPos,

		calcSegmentEndIndexPos: calcSegmentEndIndexPos

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

function GridLine( width, unitLength, initCenter, color, minOpacity ) {

	this.width = width;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.width;

	this.center = {

		x: initCenter.x,
		y: initCenter.y,
		z: initCenter.z

	};

	this.color = color;
	this.minOpacity = minOpacity;

	this.font = TextFont;
	this.textSize = TextHelper.calcQueueTextSize( this.unitLength );

	this.dataArray = undefined;
	this.dataArrayBack = undefined;

	this.dataTexture = undefined;
	this.dataTextureBack = undefined;

	this.gridEntity = undefined;
	this.gridGroup = undefined;

	this.lengthText = undefined;

	this.init();

}

GridLine.prototype = {

	init: function() {

		let amount = this.width;
		let data = new Uint8Array( amount );
		this.dataArray = data;
		let dataTex = new THREE.DataTexture( data, this.width, 1, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let dataBack = new Uint8Array( amount );
		this.dataArrayBack = dataBack;
		let dataTexBack = new THREE.DataTexture( dataBack, this.width, 1, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTextureBack = dataTexBack;

		dataTexBack.magFilter = THREE.NearestFilter;
		dataTexBack.needsUpdate = true;

		let materialBack = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTexBack,
			transparent: true

		} );

		let geometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.unitLength );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			material,
			materialBack

		];

		let cube = new THREE.Mesh( geometry, materials );

		cube.position.set( 0, 0, 0 );
		cube.elementType = "gridLine";
		cube.hoverable = true;

		this.gridEntity = cube;

		let aggregationGroup = new THREE.Object3D();
		aggregationGroup.add( cube );

		aggregationGroup.position.set( this.center.x, this.center.y, this.center.z );

		this.gridGroup = aggregationGroup;

		this.clear();

	},

	getElement: function() {

		return this.gridGroup;

	},

	setLayerIndex: function( layerIndex ) {

		this.gridEntity.layerIndex = layerIndex;

	},

	setGridIndex: function( gridIndex ) {

		this.gridEntity.gridIndex = gridIndex;

	},

	updateVis: function( colors ) {

		let backColors = RenderPreprocessor.preProcessQueueBackColor( colors );

		for ( let i = 0; i < colors.length; i++ ) {

			this.dataArray[ i ] = 255 * colors[ i ];
			this.dataArrayBack[ i ] = 255 * backColors[ i ];

		}

		this.dataTexture.needsUpdate = true;
		this.dataTextureBack.needsUpdate = true;

	},

	updatePos: function( pos ) {

		this.center.x = pos.x;
		this.center.y = pos.y;
		this.center.z = pos.z;

		this.gridGroup.position.set( this.center.x, this.center.y, this.center.z );

	},

	clear: function() {

		let zeroData = new Uint8Array( this.width );
		let colors = ColorUtils.getAdjustValues( zeroData, this.minOpacity );
		this.updateVis( colors );

	},

	showText: function() {

		let lengthTextContent = this.width.toString();

		let geometry = new THREE.TextGeometry( lengthTextContent, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let text = new THREE.Mesh( geometry, material );

		let textPos = TextHelper.calcQueueTextPos(

			lengthTextContent.length,
			this.textSize,
			this.unitLength,
			{

				x: this.gridEntity.position.x,
				y: this.gridEntity.position.y,
				z: this.gridEntity.position.z

			}

		);

		text.position.set(

			textPos.x,
			textPos.y,
			textPos.z

		);

		this.lengthText = text;

		this.gridGroup.add( this.lengthText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.gridGroup.remove( this.lengthText );
		this.lengthText = undefined;
		this.isTextShown = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq329740
 */

let CloseData = ( function() {
    return "data:image/jpeg;base64,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ZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9IjBEQjI2RkI4RTU0MDE0REVCNjJFN0Y4OTA5QTEzMDYxIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjFkN2Q3N2ZmLTVlMDItNGQ1ZC1iNDcwLWIzZTljODNlZWFmZiIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSIwREIyNkZCOEU1NDAxNERFQjYyRTdGODkwOUExMzA2MSIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOC0xMC0wOVQyMTo0NDoxMC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTgtMTAtMjRUMTE6MjQ6MTEtMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTgtMTAtMjRUMTE6MjQ6MTEtMDc6MDAiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDoxZDdkNzdmZi01ZTAyLTRkNWQtYjQ3MC1iM2U5YzgzZWVhZmYiIHN0RXZ0OndoZW49IjIwMTgtMTAtMjRUMTE6MjQ6MTEtMDc6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE3IChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/+4AIUFkb2JlAGRAAAAAAQMAEAMCAwYAAAAAAAAAAAAAAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgMDAwMDAwMDAwMBAQEBAQEBAQEBAQICAQICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//CABEIAIAAgAMBEQACEQEDEQH/xAB+AAEAAgMAAAAAAAAAAAAAAAAABwoFBggBAQAAAAAAAAAAAAAAAAAAAAAQAAICAQUBAAAAAAAAAAAAAAAIBxgFYIADBAYgEQAABQMEAgMBAQEAAAAAAAABAgMEBQAGBxHVN5chEkETFGAgFRIBAAAAAAAAAAAAAAAAAAAAgP/aAAwDAQECEQMRAAAAicAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEPlbk1sAAAGTLB51QACHytya2AAADJlg86oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2gAIAQIAAQUA2Af/2gAIAQMAAQUA2Af/2gAIAQEAAQUA1lPkpcUKxB6hsWO9ZmbGsKWNYUsawpY1hSxrCljWFLGsKWNYUxrOsTiu4ns89xhYd+J9izimqH/UKcx3k8zXJhSuTClcmFK5MKVyYUrkwpXJhSuTCmNWJicr3E+gzur7Desv/9oACAECAgY/AAB//9oACAEDAgY/AAB//9oACAEBAQY/AP7K+cmqMv8AoHteLRUYsRExU3UvKyTKDhUVxIAmK2PLyaP2iHkE9dPNPJt5mjIsWs8UE34bYu2etWGbF8aJs4W337Fg3KHxoXUfkRrnjM3aF775XPGZu0L33yueMzdoXvvlc8Zm7QvffK54zN2he++VzxmbtC998rnjM3aF775XPGZu0L33ykJBvnPK67hsoU6acjf1zTLHQB0EHMbLP3ke7AwDpocohTS7ppBuhc8JMPLUuf8AIX62jmWjmce9CRao6mBBF+yk0j+gCIFP7AHjQP8AN9YxUehHKXRFIpsXxiiZJtLRUkynIVVcpRAxmxZeMQ+0A8in7aeaeQjzC+RZRZmoJf3WxaU9dUM5L40UZzVvsHzBwUfjQ2ofIBXA+Zur732OuB8zdX3vsdcD5m6vvfY64HzN1fe+x1wPmbq+99jrgfM3V977HXA+Zur732OuB8zdX3vsdIR7fBmV0HDlQpE1JGwbmhmOgjqIuZKWYM49oBQDXU5gCmVnTLlFxc0xNvrtucrU4HZNJmVax7IY9kfx9ibGKiG5RH1L7HARANNP7P8A/9k=";
} )();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let PlusData = (function () {

    return "data:image/jpeg;base64,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AAAAAAAMY3JvcFJlY3RMZWZ0bG9uZwAAAAAAAAANY3JvcFJlY3RSaWdodGxvbmcAAAAAAAAAC2Nyb3BSZWN0VG9wbG9uZwAAAAAAOEJJTQPtAAAAAAAQAEgAAAABAAEASAAAAAEAAThCSU0EJgAAAAAADgAAAAAAAAAAAAA/gAAAOEJJTQQNAAAAAAAEAAAAHjhCSU0EGQAAAAAABAAAAB44QklNA/MAAAAAAAkAAAAAAAAAAAEAOEJJTScQAAAAAAAKAAEAAAAAAAAAAThCSU0D9QAAAAAASAAvZmYAAQBsZmYABgAAAAAAAQAvZmYAAQChmZoABgAAAAAAAQAyAAAAAQBaAAAABgAAAAAAAQA1AAAAAQAtAAAABgAAAAAAAThCSU0D+AAAAAAAcAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAA4QklNBAAAAAAAAAIAADhCSU0EAgAAAAAAAgAAOEJJTQQwAAAAAAABAQA4QklNBC0AAAAAAAYAAQAAAAM4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADPQAAAAYAAAAAAAAAAAAAAIAAAACAAAAABABwAGwAdQBzAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAACAAAAAgAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAABAAAAABAAAAAAAAbnVsbAAAAAIAAAAGYm91bmRzT2JqYwAAAAEAAAAAAABSY3QxAAAABAAAAABUb3AgbG9uZwAAAAAAAAAATGVmdGxvbmcAAAAAAAAAAEJ0b21sb25nAAAAgAAAAABSZ2h0bG9uZwAAAIAAAAAGc2xpY2VzVmxMcwAAAAFPYmpjAAAAAQAAAAAABXNsaWNlAAAAEgAAAAdzbGljZUlEbG9uZwAAAAAAAAAHZ3JvdXBJRGxvbmcAAAAAAAAABm9yaWdpbmVudW0AAAAMRVNsaWNlT3JpZ2luAAAADWF1dG9HZW5lcmF0ZWQAAAAAVHlwZWVudW0AAAAKRVNsaWNl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ZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9IjNENjI1N0JERTFFQUQ3QzI3QUZGRTQ3MjZCOTc5MEE0IiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjkzNTFjY2U2LTRjNmItNDZiZS1hYzIzLTNlNjI2MWI2NWE2MSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSIzRDYyNTdCREUxRUFEN0MyN0FGRkU0NzI2Qjk3OTBBNCIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOC0xMC0wOVQxODoyNC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTgtMTAtMjlUMDE6MTA6NTQtMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTgtMTAtMjlUMDE6MTA6NTQtMDc6MDAiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo5MzUxY2NlNi00YzZiLTQ2YmUtYWMyMy0zZTYyNjFiNjVhNjEiIHN0RXZ0OndoZW49IjIwMTgtMTAtMjlUMDE6MTA6NTQtMDc6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE3IChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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";
})();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let ConcatenateData = (function () {

    return "data:image/jpeg;base64,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AAALY3JvcFJlY3RUb3Bsb25nAAAAAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQmAAAAAAAOAAAAAAAAAAAAAD+AAAA4QklNBA0AAAAAAAQAAAAeOEJJTQQZAAAAAAAEAAAAHjhCSU0D8wAAAAAACQAAAAAAAAAAAQA4QklNJxAAAAAAAAoAAQAAAAAAAAABOEJJTQP1AAAAAABIAC9mZgABAGxmZgAGAAAAAAABAC9mZgABAKGZmgAGAAAAAAABADIAAAABAFoAAAAGAAAAAAABADUAAAABAC0AAAAGAAAAAAABOEJJTQP4AAAAAABwAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAADhCSU0EAAAAAAAAAgAAOEJJTQQCAAAAAAACAAA4QklNBDAAAAAAAAEBADhCSU0ELQAAAAAABgABAAAAAzhCSU0ECAAAAAAAEAAAAAEAAAJAAAACQAAAAAA4QklNBB4AAAAAAAQAAAAAOEJJTQQaAAAAAANLAAAABgAAAAAAAAAAAAAAgAAAAIAAAAALAGMAbwBuAGMAYQB0AGUAbgBhAHQAZQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAgAAAAIAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAG51bGwAAAACAAAABmJvdW5kc09iamMAAAABAAAAAAAAUmN0MQAAAAQAAAAAVG9wIGxvbmcAAAAAAAAAAExlZnRsb25nAAAAAAAAAABCdG9tbG9uZwAAAIAAAAAAUmdodGxvbmcAAACAAAAABnNsaWNlc1ZsTHMAAAABT2JqYwAAAAEAAAAAAAVzbGljZQAAABIAAAAHc2xpY2VJRGxvbmcAAAAAAAAAB2dyb3VwSURsb25nAAAAAAAAAAZvcmlnaW5lbnVtAAAADEVTbGljZU9yaWdpbgAAAA1hdXRvR2VuZXJhdGVkAAAAAFR5cGVlbnVtAAAACkVTbGljZVR5cGUAAAAASW1nIAAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJj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bXAuaWlkOjQ0OGViMDRhLWI4YzgtNDYxZi1hODNmLWRiYmE1ZjYzY2JmZSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJEMEQxMzJEMDEzQTc2MUQ3OTU1MkFBRDg3MTVENjlCMSIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOC0xMC0wOVQxODoyNC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTgtMTAtMjlUMDE6MTM6MDUtMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTgtMTAtMjlUMDE6MTM6MDUtMDc6MDAiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo0NDhlYjA0YS1iOGM4LTQ2MWYtYTgzZi1kYmJhNWY2M2NiZmUiIHN0RXZ0OndoZW49IjIwMTgtMTAtMjlUMDE6MTM6MDUtMDc6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE3IChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/+4AIUFkb2JlAGRAAAAAAQMAEAMC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";
})();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let SubtractData = (function () {

    return "data:image/jpeg;base64,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AAAAAQAyAAAAAQBaAAAABgAAAAAAAQA1AAAAAQAtAAAABgAAAAAAAThCSU0D+AAAAAAAcAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAA4QklNBAAAAAAAAAIAADhCSU0EAgAAAAAAAgAAOEJJTQQwAAAAAAABAQA4QklNBC0AAAAAAAYAAQAAAAM4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADOwAAAAYAAAAAAAAAAAAAAIAAAACAAAAAAwBzAHUAYgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAgAAAAIAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAG51bGwAAAACAAAABmJvdW5kc09iamMAAAABAAAAAAAAUmN0MQAAAAQAAAAAVG9wIGxvbmcAAAAAAAAAAExlZnRsb25nAAAAAAAAAABCdG9tbG9uZwAAAIAAAAAAUmdodGxvbmcAAACAAAAABnNsaWNlc1ZsTHMAAAABT2JqYwAAAAEAAAAAAAVzbGljZQAAABIAAAAHc2xpY2VJRGxvbmcAAAAAAAAAB2dyb3VwSURsb25nAAAAAAAAAAZvcmlnaW5lbnVtAAAADEVTbGljZU9yaWdpbgAAAA1hdXRvR2VuZXJhdGVkAAAAAFR5cGVlbnVtAAAACkVTbGljZVR5cGUAAAAASW1nIAAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJjdDEAAAAEAAAAAFRvcCBsb25nAAAAAAAAAABMZWZ0bG9uZwAAAAAAAAAAQnRvbWxvbmcAAACAAAAAAFJnaHRsb25nAAAAgAAAAAN1cmxURVhUAAAAAQAAAAAAAG51bGxURVhUAAAAAQAAAAAAAE1zZ2VURVhUAAAAAQAAAAAABmFsdFRhZ1RFWFQAAAABAAAAAAAOY2VsbFRleHRJc0hUTUxib29sAQAAAAhjZWxsVGV4dFRFWFQAAAABAAAAAAAJaG9yekFsaWduZW51bQAAAA9FU2xpY2VIb3J6QWxpZ24AAAAHZGVmYXVsdAAAAAl2ZXJ0QWxpZ25lbnVtAAAAD0VTbGljZVZlcnRBbGlnbgAAAAdkZWZhdWx0AAAAC2JnQ29sb3JUeXBlZW51bQAAABFFU2xpY2VCR0NvbG9yVHlwZQAAAABOb25lAAAACXRvcE91dHNldGxvbmcAAAAAAAAACmxlZnRPdXRzZXRsb25nAAAAAAAAAAxib3R0b21PdXRzZXRsb25nAAAAAAAAAAtyaWdodE91dHNldGxvbmcAAAAAADhCSU0EKAAAAAAADAAAAAI/8AAAAAAAADhCSU0EEQAAAAAAAQEAOEJJTQQUAAAAAAAEAAAAAzhCSU0EDAAAAAAE/gAAAAEAAACAAAAAgAAAAYAAAMAAAAAE4gAYAAH/2P/tAAxBZG9iZV9DTQAC/+4ADkFkb2JlAGSAAAAAAf/bAIQADAgICAkIDAkJDBELCgsRFQ8MDA8VGBMTFRMTGBEMDAwMDAwRDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAENCwsNDg0QDg4QFA4ODhQUDg4ODhQRDAwMDAwREQwMDAwMDBEMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM/8AAEQgAgACAAwEiAAIRAQMRAf/dAAQACP/EAT8AAAEFAQEBAQEBAAAAAAAAAAMAAQIEBQYHCAkKCwEAAQUBAQEBAQEAAAAAAAAAAQACAwQFBgcICQoLEAABBAEDAgQCBQcGCAUDDDMBAAIRAwQhEjEFQVFhEyJxgTIGFJGhsUIjJBVSwWIzNHKC0UMHJZJT8OHxY3M1FqKygyZEk1RkRcKjdDYX0lXiZfKzhMPTdePzRieUpIW0lcTU5PSltcXV5fVWZnaGlqa2xtbm9jdHV2d3h5ent8fX5/cRAAICAQIEBAMEBQYHBwYFNQEAAhEDITESBEFRYXEiEwUygZEUobFCI8FS0fAzJGLhcoKSQ1MVY3M08SUGFqKygwcmNcLSRJNUoxdkRVU2dGXi8rOEw9N14/NGlKSFtJXE1OT0pbXF1eX1VmZ2hpamtsbW5vYnN0dXZ3eHl6e3x//aAAwDAQACEQMRAD8AAkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSn//0AJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkp//9ECSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKf//SAkkkkpBlZuJht3ZNragdQHHU/wBVn03f2VT/AOcnRP8AuUP8yz/0muMz8u3My7Mi0y57jA8B+axv9VV0lPa2fWvpDDDTZb/UZ/6U2KH/ADw6X/o7/wDNZ/G1cakkp7H/AJ4dK/0d/wDms/8ASqX/ADx6X/o7/wDNZ/6VXHJJKex/549L/wBHf/ms/wDSqX/PHpX+jv8A81n/AKVXHJJKex/54dL/ANHf82s/9KolX1s6Q8+51lXm5k/+e/UXFJJKe7/5ydE/7lD/ADLP/Sat4mfh5rS7FtbaG/SA0I/rMdD15yrGBl24eXXkVH3McJHYj85jv5LklPoySSSSn//TAkkkkp84z8S3Dy7Me0Q5jjr2I/Ne3+S5AXo2XgYea0Nyqm2hv0SdCP6r2w9VD9WuiH/tNHwfZ/6USU8Iku0s+qfSXfRFlf8AVd/5MPUP+Z/S/wDSX/Jzf/SSSnjkl2J+p/S/9Jf/AJzP/SSY/U7pna28fFzP/SaSnj0l1v8AzNwv9Pb/ANH/AMipj6ndM723/JzB/wCi0lPHpLsf+Z3Sv9Jf/nM/9JKTfqh0oGS613kXD+DAkp4xWMDEtzMuvHqHue7UxwB9J7v6i7Fn1Z6K0a45f5l7/wDvr2q9i4WJhs2Y1TagdCWjU/1n/Tf/AGklJ0kkklP/1AJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkp//9UCSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKf//WAkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSn//2ThCSU0EIQAAAAAAXQAAAAEBAAAADwBBAGQAbwBiAGUAIABQAGgAbwB0AG8AcwBoAG8AcAAAABcAQQBkAG8AYgBlACAAUABoAG8AdABvAHMAaABvAHAAIABDAEMAIAAyADAAMQA3AAAAAQA4QklNBAYAAAAAAAcACAEBAAEBAP/hDNhodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTM4IDc5LjE1OTgyNCwgMjAxNi8wOS8xNC0wMTowOTowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9IkMzQUI1QjVBOTRENzIwMjM4OUYzNENGRUQ2QkY4ODc4IiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjhjNDA5NDc1LWQ5NzktNDk2Yy1hY2ZiLTEwNTBkNzEzZjY5NyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJDM0FCNUI1QTk0RDcyMDIzODlGMzRDRkVENkJGODg3OCIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOC0xMC0wOVQxODoyNC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTgtMTAtMjlUMDE6MTA6MjItMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTgtMTAtMjlUMDE6MTA6MjItMDc6MDAiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo4YzQwOTQ3NS1kOTc5LTQ5NmMtYWNmYi0xMDUwZDcxM2Y2OTciIHN0RXZ0OndoZW49IjIwMTgtMTAtMjlUMDE6MTA6MjItMDc6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE3IChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/+4AIUFkb2JlAGRAAAAAAQMAEAMCAwYAAAAAAAAAAAAAAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgMDAwMDAwMDAwMBAQEBAQEBAQEBAQICAQICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//CABEIAIAAgAMBEQACEQEDEQH/xACbAAEBAAIDAQAAAAAAAAAAAAAABwYIAgQKAwEBAAAAAAAAAAAAAAAAAAAAABAAAQIFAwUBAAAAAAAAAAAABwgJAAECAwUEBhkgMGCAERIRAAEDAwMBAwUNCQAAAAAAAAECAwQFBgcAERIhMUEUIJEykhMwYGFxgSJyFRY2lhfXUaGxQqJTJNU3EgEAAAAAAAAAAAAAAAAAAACA/9oADAMBAQIRAxEAAACTgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAl5reTgxU4HwB9jmZUUg2EK4ADxbEgAAAABXz2kgA8WpIQAAAAWU9oYAJGa7E1MaOJ1DHjIjtnfKkbTFOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2gAIAQIAAQUA9AP/2gAIAQMAAQUA9AP/2gAIAQEAAQUA8iJ5rEwXxlbkaI6I3G62krCXZO/pc/fMIlqccw6YY5h0wxJ4VLXyTwKXKqttOupJzt2hyNEdcCQ9B47Y7oOxW3QbCv2gUWN1hQr9B0FG6wkVe0CBLuk3FboLQGDx1x2sbYRPq5Zxp1JmWnNn1LddV1ntL1yq+zumqdPDcFItM8Jr+cPSWvmiaLSxpdRi2y0WY+0MAuJwvi/Iv//aAAgBAgIGPwAAf//aAAgBAwIGPwAAf//aAAgBAQEGPwD3xIq2U8g2vZMd9hyTCi1mpst1mrMNOFl5yh28wX6/Xgw6OK/BRnyg9FbaUDnWKpSVFJQjHOYl7lJIPFxOOyytO46EKIPcdNtUqpX/AHpzVxLls2TIjob7eqk3dNtV1QO38iVHQb+yec3SU782LTsANDqRxK52UoCgrYb+jt17e3WyLNz+pR7AbOx0AT9L82z/AA19yc8/hTHv6p6+5Oefwpj39U9dbOz+FfsFnY7I9b82wf3aKBaedWiBvzk2lYQaJ3A4pVDyjOUVEHf0dunbpxuqVO/rMSggJeuWypEpp7cA7tiz511vAAnb56EHSQM6xUqUoJCF45zEjqo7AqcVjsMoTv2kqAHfqdU8S5AoF6NUsp+tYcB5+JW6U246thiTVLdqrECv06FKebUlh96Mhl8pIbUrY+TeuSLvfL9VuKtS1sRhJlSY1FpMZ7wtHt+l+JcWtql0WnsIYjoVurgOSypaio+5WTkm0ZS2qrQK3CceimVIjRa3SH3URKxbtUMVxt5yl1unOLYfQPncFBSdlJSoeReeObwjqZq1Ark5tmQmPMjw6zSJLhfpFxUvxbLK3aRXqe4h5hXpcSUrCVJI9zsvHNoMOO1C4K3FYem+Cfkx6LSIrol1i4qomOlZaptBpyC/IUlXMI4to5KWlJ8iFTMs4/oF6NUwn6rmT2XolbpTa3kPvRqXcdKfgXBTYUp5tKn2GJLbL5SPaJVsNLKcJNQ3XFKWp6HkPLDZBUSSEMu349EbTueiUthIHQADSTAi5FtgJO5FDvPxAX8CvtLSrhIHxEHXJd252a6bcIt32G2g9SeR8Vi+avkd9uigNh2du5Um889p37lXfj5zb4ATioK8++v8W+85Mr7lSLjsGSj5UIxpFJ8+v+qZS9S0/wDRa3l33nB1feY1wY/ho+Rs40k7efXW8c/8u8/bHHQG/wAX5SdPPpLz9Wy5Um09sWbdtAQwv6aqdZ9Pleq4nXs5eJJVcX/fqmRMmMu+aiXhR2P6NLpGLMf2vZEV9hqNOkUSlsNVirsML9rHRXrgeD1euDw7hKmzNkyFIJJSRuffH//Z";
})();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let MultiplyData = (function () {

    return "data:image/jpeg;base64,/9j/4QknRXhpZgAATU0AKgAAAAgADAEAAAMAAAABAIAAAAEBAAMAAAABAIAAAAECAAMAAAADAAAAngEGAAMAAAABAAIAAAESAAMAAAABAAEAAAEVAAMAAAABAAMAAAEaAAUAAAABAAAApAEbAAUAAAABAAAArAEoAAMAAAABAAIAAAExAAIAAAAkAAAAtAEyAAIAAAAUAAAA2IdpAAQAAAABAAAA7AAAASQACAAIAAgACvyAAAAnEAAK/IAAACcQQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKE1hY2ludG9zaCkAMjAxODoxMDoyOSAwMToxMToyNwAABJAAAAcAAAAEMDIyMaABAAMAAAAB//8AAKACAAQAAAABAAAAgKADAAQAAAABAAAAgAAAAAAAAAAGAQMAAwAAAAEABgAAARoABQAAAAEAAAFyARsABQAAAAEAAAF6ASgAAwAAAAEAAgAAAgEABAAAAAEAAAGCAgIABAAAAAEAAAedAAAAAAAAAEgAAAABAAAASAAAAAH/2P/tAAxBZG9iZV9DTQAC/+4ADkFkb2JlAGSAAAAAAf/bAIQADAgICAkIDAkJDBELCgsRFQ8MDA8VGBMTFRMTGBEMDAwMDAwRDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAENCwsNDg0QDg4QFA4ODhQUDg4ODhQRDAwMDAwREQwMDAwMDBEMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM/8AAEQgAgACAAwEiAAIRAQMRAf/dAAQACP/EAT8AAAEFAQEBAQEBAAAAAAAAAAMAAQIEBQYHCAkKCwEAAQUBAQEBAQEAAAAAAAAAAQACAwQFBgcICQoLEAABBAEDAgQCBQcGCAUDDDMBAAIRAwQhEjEFQVFhEyJxgTIGFJGhsUIjJBVSwWIzNHKC0UMHJZJT8OHxY3M1FqKygyZEk1RkRcKjdDYX0lXiZfKzhMPTdePzRieUpIW0lcTU5PSltcXV5fVWZnaGlqa2xtbm9jdHV2d3h5ent8fX5/cRAAICAQIEBAMEBQYHBwYFNQEAAhEDITESBEFRYXEiEwUygZEUobFCI8FS0fAzJGLhcoKSQ1MVY3M08SUGFqKygwcmNcLSRJNUoxdkRVU2dGXi8rOEw9N14/NGlKSFtJXE1OT0pbXF1eX1VmZ2hpamtsbW5vYnN0dXZ3eHl6e3x//aAAwDAQACEQMRAD8AAkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSn//0AJJJJKaHVur0dMpDnD1Lnz6VQ7x+c792tcfk9c6pkvLn5D2DsysljR/ZZ/35D6pmOzs+7IcTDnEVg9mDStv+aqiSnpug/WV24YvUbJB/m8h54/k3OP/AJ8XULzFdL9XfrCGBuDnPAYAG03OgBoA/m7D+5+49JT1KSSSSlJJKL3srY6yxwYxolzjoAB4pKU97K2OsscGMYJc4mAAPFcd1j6yZGXaa8N76MZugLTte8/vPLfzP5Ch17rz+oP9CglmIw6DgvI/Pf8Ayf3GLHSU6mB9YupYb5fa7JrP0q7SXf5tjpexdlg52Pn4zcjHdLTo5p5a4fSY9ecrb+qWXZV1L7MDNeS1wcPAsDrGO/6L2JKezSSSSU//0QJJJJKeT+sfQHUufn4gmknddWOWE82N/wCC/wDPa51emkAiDqDyFyX1h+r32fdm4Tf0HNtQ/M/lt/4L/wA9pKefSSSSU9N9XfrC1jWYOc4BgG2m50AAAaV2fyf3HrqF5ium+r/1jaxjcPPfDWiKbj2A/wAHZ/3x6SnpnvZWx1ljg1jRLnEwAB3K4zr3Xn9QcaMcluI06DgvI/Pf/J/cYm6915/UHmigluIw/AvI/Pf/ACf3GLHSUpJJJJSl2P1d6E7C/XMoRkOBFdf7gPO7/hXf9BR+r/1f+y7czMb+sc11n/B/ynf8L/56/wCMW+kpSSSSSn//0gJJJJKUmIBEHUHkJ0klPI/WH6vfZ92bhN/Qc21D8z+W3/gv/Pa59emkAiDqDyFyX1i+r4xd2dhiMcn9LX+4SY3M/wCC/wCoSU8+kkkkpSSSSSlLr/q/9Xvsu3MzG/rB1rrP+D/lO/4X/wA9f8Yl9X/q+MYNzcts3nWqs67P5bv+F/8APX/GLfSUpJJJJSkkkklP/9MCSSSSlJJKNljK2OsscGMYJc46AAJKU97K2OsscGMaJc46AAdyuL6715/UXmiglmI06DgvI/Pf/wB8Yl17rz+oP9CiW4bDoOC8j89/8n9xix0lKSSSSUpJJJJT031e+sQaG4Oc+GjSm52kR/g7Hfu/uPXULzFdL9XvrC1jW4Oc4BgAbTc6AGgD+bsP7v7j0lPUpJJJKUkkkkp//9QCSSSSmL3srY6yxwYxolziYAA8VxnXuvP6g70KJZiMMgcF5H57/wCT+4xS+sXWn5tzsSk7cWp0afnuGnqO/wCD/cWIkpSSSSSlLr+gfV4YzRl5rQ69w9lThIYD+8P9L/57S+r/ANXxi7czMb+sHWqs/wCD/lO/4X/z1/xi30lPJfWH6vehuzcJv6Dm2ofmfy2f8F/57/4v+b55em86Hhcn9Yfq99n3ZuE39BzbUPzP5bP+C/8APf8AxaSnnkkkklPS/V36whgZg5zgGAbabjoABxXZ/J/ceupXmK6n6r9bstc3puT7iGn0H94aN3pO/sN9iSnpUkkklP8A/9UCSSSSnz/rWA7A6jbTEVuO+o+LHH2/5v0FRXofUumY3UqPSvEFutdg+k0nw/7+xcnk/Vbq1Nm2qsXs7PY4D72PLXNSU5C6/wCr/wBX/su3NzG/rHNVR/M/lu/4X/z1/wAZ9BdB+rpxHDLzQDkD+brkEM/luI9rrP3f9H/5730lKSSSSUpMQCIOoPITpJKeR+sP1e+zbs3Cb+r821D8z+Uz/gv/AD2ufXppAIg6g8hcv1n6r2i31+mM3Vv+lRIBafFhf9Kv+Qkp5pb31Rwn25xzDpXjNIB8XvBZt/s1lyWB9U82585kY9Q5AIc8/wBUN3NZ/bXV42NTi0MooaGVsEAD8p/lOSUlSSSSU//WAkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSn//2f/tEPpQaG90b3Nob3AgMy4wADhCSU0EBAAAAAAADxwBWgADGyVHHAIAAAIAAAA4QklNBCUAAAAAABDNz/p9qMe+CQVwdq6vBcNOOEJJTQQ6AAAAAADlAAAAEAAAAAEAAAAAAAtwcmludE91dHB1dAAAAAUAAAAAUHN0U2Jvb2wBAAAAAEludGVlbnVtAAAAAEludGUAAAAAQ2xybQAAAA9wcmludFNpeHRlZW5CaXRib29sAAAAAAtwcmludGVyTmFtZVRFWFQAAAABAAAAAAAPcHJpbnRQcm9vZlNldHVwT2JqYwAAAAwAUAByAG8AbwBmACAAUwBlAHQAdQBwAAAAAAAKcHJvb2ZTZXR1cAAAAAEAAAAAQmx0bmVudW0AAAAMYnVpbHRpblByb29mAAAACXByb29mQ01ZSwA4QklNBDsAAAAAAi0AAAAQAAAAAQAAAAAAEnByaW50T3V0cHV0T3B0aW9ucwAAABcAAAAAQ3B0bmJvb2wAAAAAAENsYnJib29sAAAAAABSZ3NNYm9vbAAAAAAAQ3JuQ2Jvb2wAAAAAAENudENib29sAAAAAABMYmxzYm9vbAAAAAAATmd0dmJvb2wAAAAAAEVtbERib29sAAAAAABJbnRyYm9vbAAAAAAAQmNrZ09iamMAAAABAAAAAAAAUkdCQwAAAAMAAAAAUmQgIGRvdWJAb+AAAAAAAAAAAABHcm4gZG91YkBv4AAAAAAAAAAAAEJsICBkb3ViQG/gAAAAAAAAAAAAQnJkVFVudEYjUmx0AAAAAAAAAAAAAAAAQmxkIFVudEYjUmx0AAAAAAAAAAAAAAAAUnNsdFVudEYjUHhsQFIAAAAAAAAAAAAKdmVjdG9yRGF0YWJvb2wBAAAAAFBnUHNlbnVtAAAAAFBnUHMAAAAAUGdQQwAAAABMZWZ0VW50RiNSbHQAAAAAAAAAAAAAAABUb3AgVW50RiNSbHQAAAAAAAAAAAAAAABTY2wgVW50RiNQcmNAWQAAAAAAAAAAABBjcm9wV2hlblByaW50aW5nYm9vbAAAAAAOY3JvcFJlY3RCb3R0b21sb25nAAAAAAAAAAxjcm9wUmVjdExlZnRsb25nAAAAAAAAAA1jcm9wUmVjdFJpZ2h0bG9uZwAAAAAAAAALY3JvcFJlY3RUb3Bsb25nAAAAAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQmAAAAAAAOAAAAAAAAAAAAAD+AAAA4QklNBA0AAAAAAAQAAAAeOEJJTQQZAAAAAAAEAAAAHjhCSU0D8wAAAAAACQAAAAAAAAAAAQA4QklNJxAAAAAAAAoAAQAAAAAAAAABOEJJTQP1AAAAAABIAC9mZgABAGxmZgAGAAAAAAABAC9mZgABAKGZmgAGAAAAAAABADIAAAABAFoAAAAGAAAAAAABADUAAAABAC0AAAAGAAAAAAABOEJJTQP4AAAAAABwAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAADhCSU0EAAAAAAAAAgAAOEJJTQQCAAAAAAACAAA4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eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSI2RDFGODAwQjQ2QURFQzNCRUQ0QUU4QTFBQkFGN0FEOCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo5NDQzZTI3Ny00MTIxLTQ5NWQtYjY4Ny1jZTNlNjM4OTJlYjMiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0iNkQxRjgwMEI0NkFERUMzQkVENEFFOEExQUJBRjdBRDgiIGRjOmZvcm1hdD0iaW1hZ2UvanBlZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9IiIgeG1wOkNyZWF0ZURhdGU9IjIwMTgtMTAtMDlUMTg6MjQtMDc6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE4LTEwLTI5VDAxOjExOjI3LTA3OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE4LTEwLTI5VDAxOjExOjI3LTA3OjAwIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6OTQ0M2UyNzctNDEyMS00OTVkLWI2ODctY2UzZTYzODkyZWIzIiBzdEV2dDp3aGVuPSIyMDE4LTEwLTI5VDAxOjExOjI3LTA3OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxNyAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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";
})();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let MaximumData = (function () {

    return "data:image/jpeg;base64,/9j/4QiRRXhpZgAATU0AKgAAAAgADAEAAAMAAAABAIAAAAEBAAMAAAABAIAAAAECAAMAAAADAAAAngEGAAMAAAABAAIAAAESAAMAAAABAAEAAAEVAAMAAAABAAMAAAEaAAUAAAABAAAApAEbAAUAAAABAAAArAEoAAMAAAABAAIAAAExAAIAAAAkAAAAtAEyAAIAAAAUAAAA2IdpAAQAAAABAAAA7AAAASQACAAIAAgACvyAAAAnEAAK/IAAACcQQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKE1hY2ludG9zaCkAMjAxODoxMDoyOSAwMToxMjowMgAABJAAAAcAAAAEMDIyMaABAAMAAAAB//8AAKACAAQAAAABAAAAgKADAAQAAAABAAAAgAAAAAAAAAAGAQMAAwAAAAEABgAAARoABQAAAAEAAAFyARsABQAAAAEAAAF6ASgAAwAAAAEAAgAAAgEABAAAAAEAAAGCAgIABAAAAAEAAAcHAAAAAAAAAEgAAAABAAAASAAAAAH/2P/tAAxBZG9iZV9DTQAC/+4ADkFkb2JlAGSAAAAAAf/bAIQADAgICAkIDAkJDBELCgsRFQ8MDA8VGBMTFRMTGBEMDAwMDAwRDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAENCwsNDg0QDg4QFA4ODhQUDg4ODhQRDAwMDAwREQwMDAwMDBEMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM/8AAEQgAgACAAwEiAAIRAQMRAf/dAAQACP/EAT8AAAEFAQEBAQEBAAAAAAAAAAMAAQIEBQYHCAkKCwEAAQUBAQEBAQEAAAAAAAAAAQACAwQFBgcICQoLEAABBAEDAgQCBQcGCAUDDDMBAAIRAwQhEjEFQVFhEyJxgTIGFJGhsUIjJBVSwWIzNHKC0UMHJZJT8OHxY3M1FqKygyZEk1RkRcKjdDYX0lXiZfKzhMPTdePzRieUpIW0lcTU5PSltcXV5fVWZnaGlqa2xtbm9jdHV2d3h5ent8fX5/cRAAICAQIEBAMEBQYHBwYFNQEAAhEDITESBEFRYXEiEwUygZEUobFCI8FS0fAzJGLhcoKSQ1MVY3M08SUGFqKygwcmNcLSRJNUoxdkRVU2dGXi8rOEw9N14/NGlKSFtJXE1OT0pbXF1eX1VmZ2hpamtsbW5vYnN0dXZ3eHl6e3x//aAAwDAQACEQMRAD8AAkkkkpSSSSSlJJJJKUkkkkpSSbgSeBygftHp/wD3Jp/7cb/5JJTYSVf9o9P/AO5VP/bjf/JJftHp/wD3Kp/7cb/5JJTYSVf9o9P/AO5VP/bjf/JKVeZiWv2VX12PP5rXtJ+5pSUmSSSSU//QAkkkkpSSSSSlJJJJKUkkkkpzfrBj5eT0yyrEkv3NL2DlzB9Jjf8AouXG/srqn/cO/wD7af8A+RXoiSSnzv8AZXVP+4d//bT/APyKX7K6p/3Dv/7af/5FeiKh1bq1HTaNzvfc8H0qu5P7zv3ampKeDuouof6d9bqn87XgtOvk5RY9zHB7CWuaZBHZWXOzurZ0mbsi4wB2+A/crYgXVPptfTYIfW4sePAtO1ySn0XEtddiU2v+lZW1zo01cA4oyr9O/wCT8X/ia/8AqWqwkp//0QJJJJKUkkkkpSSSSSlJJJJKUkkqHVurUdMo3v8Afc8foqu5P7zv3a0lL9W6tR0yje/33P8A5qru4/vO/drXEudm9UzZM3ZNxgD+A/cYxJzs3qudJm7JuMAaDgcD81rWtXZdG6NT0yns/JeP0tv/AKLr/wCD/wCrSUrovRqemUyYfkvH6W3/ANF1/wDB/wDVrjeq/wDKmZ/x9v8A1bl6IvO+q/8AKmZ/x9v/AFbklPedO/5Pxf8Aia/+parCr9O/5Pxf+Jr/AOparCSn/9ICSSSSlJJJJKUkkkkpSSSSSmj1bqtPTMf1Hjfa+RVV4kd3f8G389cQ9+Z1PMkzdkXugAfk/kta3/MXWfWHol3U/Stoe1tlQLSx8gEE7pBG73I/Rui09MqJ0syXj9Jb4D/R1/yP+rSUro3RqumUyYflWD9LZ2A/0Vf/AAf/AFa0kkklKXnfVf8AlTM/4+3/AKty9EWdk9A6ZlZf2u6smwmXtDoa4gR72/8AkUlNnp/9Axv+Jr/6lqsJJJKf/9MCSSSSnHt+s/T6s44hDi1rtj7h9EO76fS2tctheb5v9Nv/AONf/wBUV6O36I+CSl0klQ6t1ajplG5/vuf/ADVXc/ynfu1tSUv1bq1HTKN7/fc/+aq7k/vO/drasn6v/WDNzM77LlRYLA4scAG7NoL9dv0mOXPPfm9UzZM3ZFxgAeX5rfzWta1dl0XotXTKpdD8qwRZZ2A59Ov+R/58SU6aSSSSlJJJJKUkkkkpSSSSSn//1AJJJJKfN83+m3/8a/8A6or0dv0R8F5xm/02/wD41/8A1RXcdU6vR0zGDn++54/RVdyf3n/8Gkpfq3VqOmUb3++5/wDNVeJ/ed+7W1cQ9+Z1PMkzdk3HQf6/Ra3/AKCdzs3qmbJm7IuOgGnHYfmta1dl0XotPTKpMWZTx+ks7Af6Ov8Akf8AnxJSui9Fq6ZTLoflPH6SwcAf6Ov+R/58WmkkkpSSSSSlJJJJKUkkkkpSSSSSn//VAkkkkp83zf6bkf8AGv8A+qKcfas/Ja2XX5FpDWyZJ/NbqUTqmNfj9QvZawtcXucPAgkua5v9ZVW72kObII4I0KSnu+i9Fq6ZTJh+S8fpbPx9Ov8Akf8AVrSXm/2rM/0tn+c7+9R9bJ/ff95SU+lJLzX18kaix/3ldf8AVWzOfh2fadxpDh6Dn8nQ+rE/mbtqSnbSSSSUpJJJJSkkkklKSSSSU//WAkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSn//2f/tEFxQaG90b3Nob3AgMy4wADhCSU0EBAAAAAAABxwCAAACAAAAOEJJTQQlAAAAAAAQ6PFc8y/BGKGie2etxWTVujhCSU0EOgAAAAAA5QAAABAAAAABAAAAAAALcHJpbnRPdXRwdXQAAAAFAAAAAFBzdFNib29sAQAAAABJbnRlZW51bQAAAABJbnRlAAAAAENscm0AAAAPcHJpbnRTaXh0ZWVuQml0Ym9vbAAAAAALcHJpbnRlck5hbWVURVhUAAAAAQAAAAAAD3ByaW50UHJvb2ZTZXR1cE9iamMAAAAMAFAAcgBvAG8AZgAgAFMAZQB0AHUAcAAAAAAACnByb29mU2V0dXAAAAABAAAAAEJsdG5lbnVtAAAADGJ1aWx0aW5Qcm9vZgAAAAlwcm9vZkNNWUsAOEJJTQQ7AAAAAAItAAAAEAAAAAEAAAAAABJwcmludE91dHB1dE9wdGlvbnMAAAAXAAAAAENwdG5ib29sAAAAAABDbGJyYm9vbAAAAAAAUmdzTWJvb2wAAAAAAENybkNib29sAAAAAABDbnRDYm9vbAAAAAAATGJsc2Jvb2wAAAAAAE5ndHZib29sAAAAAABFbWxEYm9vbAAAAAAASW50cmJvb2wAAAAAAEJja2dPYmpjAAAAAQAAAAAAAFJHQkMAAAADAAAAAFJkICBkb3ViQG/gAAAAAAAAAAAAR3JuIGRvdWJAb+AAAAAAAAAAAABCbCAgZG91YkBv4AAAAAAAAAAAAEJyZFRVbnRGI1JsdAAAAAAAAAAAAAAAAEJsZCBVbnRGI1JsdAAAAAAAAAAAAAAAAFJzbHRVbnRGI1B4bEBSAAAAAAAAAAAACnZlY3RvckRhdGFib29sAQAAAABQZ1BzZW51bQAAAABQZ1BzAAAAAFBnUEMAAAAATGVmdFVudEYjUmx0AAAAAAAAAAAAAAAAVG9wIFVudEYjUmx0AAAAAAAAAAAAAAAAU2NsIFVudEYjUHJjQFkAAAAAAAAAAAAQY3JvcFdoZW5QcmludGluZ2Jvb2wAAAAADmNyb3BSZWN0Qm90dG9tbG9uZwAAAAAAAAAMY3JvcFJlY3RMZWZ0bG9uZwAAAAAAAAANY3JvcFJlY3RSaWdodGxvbmcAAAAAAAAAC2Nyb3BSZWN0VG9wbG9uZwAAAAAAOEJJTQPtAAAAAAAQAEgAAAABAAEASAAAAAEAAThCSU0EJgAAAAAADgAAAAAAAAAAAAA/gAAAOEJJTQQNAAAAAAAEAAAAHjhCSU0EGQAAAAAABAAAAB44QklNA/MAAAAAAAkAAAAAAAAAAAEAOEJJTScQAAAAAAAKAAEAAAAAAAAAAThCSU0D9QAAAAAASAAvZmYAAQBsZmYABgAAAAAAAQAvZmYAAQChmZoABgAAAAAAAQAyAAAAAQBaAAAABgAAAAAAAQA1AAAAAQAtAAAABgAAAAAAAThCSU0D+AAAAAAAcAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAA4QklNBAAAAAAAAAIAADhCSU0EAgAAAAAAAgAAOEJJTQQwAAAAAAABAQA4QklNBC0AAAAAAAYAAQAAAAM4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADRQAAAAYAAAAAAAAAAAAAAIAAAACAAAAACABtAGEAeABpAG0AaQB6AGUAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAA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AHQAbwBzAGgAbwBwAAAAFwBBAGQAbwBiAGUAIABQAGgAbwB0AG8AcwBoAG8AcAAgAEMAQwAgADIAMAAxADcAAAABADhCSU0EBgAAAAAABwAIAQEAAQEA/+EM2Gh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxMzggNzkuMTU5ODI0LCAyMDE2LzA5LzE0LTAxOjA5OjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1wTU06RG9jdW1lbnRJRD0iOENBMEI4MUIyMUZEMDUyNTRDQUIzMjY3QUY0NjZCMkYiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ZmVkODQ3NTMtMWVjNC00YzgxLThiZDMtODg4ZGVlYmNkY2IwIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9IjhDQTBCODFCMjFGRDA1MjU0Q0FCMzI2N0FGNDY2QjJGIiBkYzpmb3JtYXQ9ImltYWdlL2pwZWciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSIiIHhtcDpDcmVhdGVEYXRlPSIyMDE4LTEwLTA5VDE4OjI0LTA3OjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAxOC0xMC0yOVQwMToxMjowMi0wNzowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAxOC0xMC0yOVQwMToxMjowMi0wNzowMCI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmZlZDg0NzUzLTFlYzQtNGM4MS04YmQzLTg4OGRlZWJjZGNiMCIgc3RFdnQ6d2hlbj0iMjAxOC0xMC0yOVQwMToxMjowMi0wNzowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKE1hY2ludG9zaCkiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw/eHBhY2tldCBlbmQ9InciPz7/7gAhQWRvYmUAZEAAAAABAwAQAwIDBgAAAAAAAAAAAAAAAP/bAIQAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAwMDAwMDAwMDAwEBAQEBAQEBAQEBAgIBAgIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD/8IAEQgAgACAAwERAAIRAQMRAf/EAK8AAQEAAwEBAAMBAAAAAAAAAAAKAgcICQUBAwQGAQEA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";
})();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let AverageData = ( function() {
    return "data:image/jpeg;base64,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SU0nEAAAAAAACgABAAAAAAAAAAE4QklNA/UAAAAAAEgAL2ZmAAEAbGZmAAYAAAAAAAEAL2ZmAAEAoZmaAAYAAAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAA4QklNBAIAAAAAAAIAADhCSU0EMAAAAAAAAQEAOEJJTQQtAAAAAAAGAAEAAAAEOEJJTQQIAAAAAAAQAAAAAQAAAkAAAAJAAAAAADhCSU0EHgAAAAAABAAAAAA4QklNBBoAAAAAA0MAAAAGAAAAAAAAAAAAAACAAAAAgAAAAAcAYQB2AGUAcgBhAGcAZQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAgAAAAIAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAG51bGwAAAACAAAABmJvdW5kc09iamMAAAABAAAAAAAAUmN0MQAAAAQAAAAAVG9wIGxvbmcAAAAAAAAAAExlZnRsb25nAAAAAAAAAABCdG9tbG9uZwAAAIAAAAAAUmdodGxvbmcAAACAAAAABnNsaWNlc1ZsTHMAAAABT2JqYwAAAAEAAAAAAAVzbGljZQAAABIAAAAHc2xpY2VJRGxvbmcAAAAAAAAAB2dyb3VwSURsb25nAAAAAAAAAAZvcmlnaW5lbnVtAAAADEVTbGljZU9yaWdpbgAAAA1hdXRvR2VuZXJhdGVkAAAAAFR5cGVlbnVtAAAACkVTbGljZVR5cGUAAAAASW1nIAAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJjdDEAAAAEAAAAAFRvcCBsb25nAAAAAAAAAABMZWZ0bG9uZwAAAAAAAAAAQnRvbWxvbmcAAACAAAAAAFJnaHRsb25nAAAAgAAAAAN1cmxURVhUAAAAAQAAAAAAAG51bGxURVhUAAAAAQAAAAAAAE1zZ2VURVhUAAAAAQAAAAAABmFsdFRhZ1RFWFQAAAAB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AAAAAAAHAAgBAQABAQD/4Q30aHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzEzOCA3OS4xNTk4MjQsIDIwMTYvMDkvMTQtMDE6MDk6MDEgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSI0RTI0REEwMEM1NDYyNkZFMDczMjBCQzNBQTc4OUJEMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpjN2ZjZjY1NS1iNTI4LTQ4NGItYTUzNC1jOGQ0MjI3ZmVjYTMiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0iNEUyNERBMDBDNTQ2MjZGRTA3MzIwQkMzQUE3ODlCRDEiIGRjOmZvcm1hdD0iaW1hZ2UvanBlZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9IiIgeG1wOkNyZWF0ZURhdGU9IjIwMTgtMTAtMDlUMTg6MjQtMDc6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE4LTEwLTI5VDAxOjA5OjQxLTA3OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE4LTEwLTI5VDAxOjA5OjQxLTA3OjAwIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6YzdmY2Y2NTUtYjUyOC00ODRiLWE1MzQtYzhkNDIyN2ZlY2EzIiBzdEV2dDp3aGVuPSIyMDE4LTEwLTI5VDAxOjA5OjQxLTA3OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxNyAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPHBob3Rvc2hvcDpEb2N1bWVudEFuY2VzdG9ycz4gPHJkZjpCYWc+IDxyZGY6bGk+REFDNjIyOUY1RUJFNjkyM0M0NkQ1MDAxMEM2NUE2NEI8L3JkZjpsaT4gPHJkZjpsaT5hZG9iZTpkb2NpZDpwaG90b3Nob3A6MTJmNmM5NjItMTg0OS0xMTdjLWExMjktZDhhY2UxZjkwMThhPC9yZGY6bGk+IDxyZGY6bGk+YWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOmQ4Zjc3YTVjLWZkZjItMTE3Yi04ZTRiLTkzODAxNDMzYjRkODwvcmRmOmxpPiA8L3JkZjpCYWc+IDwvcGhvdG9zaG9wOkRvY3VtZW50QW5jZXN0b3JzPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/+4AIUFkb2JlAGRA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";
} )();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let DotData = (function () {

    return "data:image/jpeg;base64,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AAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAA4QklNBAIAAAAAAAIAADhCSU0EMAAAAAAAAQEAOEJJTQQtAAAAAAAGAAEAAAADOEJJTQQIAAAAAAAQAAAAAQAAAkAAAAJAAAAAADhCSU0EHgAAAAAABAAAAAA4QklNBBoAAAAAAzsAAAAGAAAAAAAAAAAAAACAAAAAgAAAAAMAZABvAHQAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAIAAAACAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAEAAAAAAABudWxsAAAAAgAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJjdDEAAAAEAAAAAFRvcCBsb25nAAAAAAAAAABMZWZ0bG9uZwAAAAAAAAAAQnRvbWxvbmcAAACAAAAAAFJnaHRsb25nAAAAgAAAAAZzbGljZXNWbExzAAAAAU9iamMAAAABAAAAAAAFc2xpY2UAAAASAAAAB3NsaWNlSURsb25nAAAAAAAAAAdncm91cElEbG9uZwAAAAAAAAAGb3JpZ2luZW51bQAAAAxFU2xpY2VPcmlnaW4AAAANYXV0b0dlbmVyYXRlZAAAAABUeXBlZW51bQAAAApFU2xpY2VUeXBlAAAAAEltZyAAAAAGYm91bmRzT2JqYwAAAAEAAAAAAABSY3QxAAAABAAAAABUb3AgbG9uZwAAAAAAAAAATGVmdGxvbmcAAAAAAAAAAEJ0b21sb25nAAAAgAAAAABSZ2h0bG9uZwAAAIAAAAADdXJsVEVYVAAAAAEAAAAAAABudWxsVEVYVAAAAAEAAAAAAABNc2dlVEVYVAAAAAEAAAAAAAZhbHRUYWdURVhUAAAAAQAAAAAADmNlbGxUZXh0SXNIVE1MYm9vbAEAAAAIY2VsbFRleHRURVhUAAAAAQAAAAAACWhvcnpBbGlnbmVudW0AAAAPRVNsaWNlSG9yekFsaWduAAAAB2RlZmF1bHQAAAAJdmVydEFsaWduZW51bQAAAA9FU2xpY2VWZXJ0QWxpZ24AAAAHZGVmYXVsdAAAAAtiZ0NvbG9yVHlwZWVudW0AAAARRVNsaWNlQkdDb2xvclR5cGUAAAAATm9uZQAAAAl0b3BPdXRzZXRsb25nAAAAAAAAAApsZWZ0T3V0c2V0bG9uZwAAAAAAAAAMYm90dG9tT3V0c2V0bG9uZwAAAAAAAAALcmlnaHRPdXRzZXRsb25nAAAAAAA4QklNBCgAAAAAAAwAAAACP/AAAAAAAAA4QklNBBEAAAAAAAEBADhCSU0EFAAAAAAABAAAAAM4QklNBAwAAAAABP8AAAABAAAAgAAAAIAAAAGAAADAAAAABOMAGAAB/9j/7QAMQWRvYmVfQ00AAv/uAA5BZG9iZQBkgAAAAAH/2wCEAAwICAgJCAwJCQwRCwoLERUPDAwPFRgTExUTExgRDAwMDAwMEQwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwBDQsLDQ4NEA4OEBQODg4UFA4ODg4UEQwMDAwMEREMDAwMDAwRDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDP/AABEIAIAAgAMBIgACEQEDEQH/3QAEAAj/xAE/AAABBQEBAQEBAQAAAAAAAAADAAECBAUGBwgJCgsBAAEFAQEBAQEBAAAAAAAAAAEAAgMEBQYHCAkKCxAAAQQBAwIEAgUHBggFAwwzAQACEQMEIRIxBUFRYRMicYEyBhSRobFCIyQVUsFiMzRygtFDByWSU/Dh8WNzNRaisoMmRJNUZEXCo3Q2F9JV4mXys4TD03Xj80YnlKSFtJXE1OT0pbXF1eX1VmZ2hpamtsbW5vY3R1dnd4eXp7fH1+f3EQACAgECBAQDBAUGBwcGBTUBAAIRAyExEgRBUWFxIhMFMoGRFKGxQiPBUtHwMyRi4XKCkkNTFWNzNPElBhaisoMHJjXC0kSTVKMXZEVVNnRl4vKzhMPTdePzRpSkhbSVxNTk9KW1xdXl9VZmdoaWprbG1ub2JzdHV2d3h5ent8f/2gAMAwEAAhEDEQA/AAJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkp//9ACSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKf//RAkkkkpSSSSSlJJIeRkU41L773BlVYlzikpIoWW1VDda9tY8XEAf9Jch1P60ZeS8sw3HGoGgIj1Hfyi8fzf8A1tYjnOcSXElx5J1JSU+lV21WjdU9tjfFpBH/AEVNeZNc5pDmkhw4I0K2+mfWnLxnCvNJyaOC4/zg/lB/+E/64kp7JJDx8inJpZfQ4PqsEtcERJSkkkklKSSSSU//0gJJJJKUkkkkpS4760dUdk5Rwqz+gxzDh+9YNHz/AMXPprrrrRTU+13FbS4/Bo3LzVznPcXOMuJknzKSlkkkklKSSSSU7v1W6o7HyhhWH9BkGGg/m2HRm3/jP5tdivMmuc1wc0w5pkHzC9KptF1TLW6CxocPg4bklM0kkklKSSSSU//TAkkkkpSSSSSmNlbbK3Vu+i8Fp+BELzR7HMeWOEOaSCPML01cd9aemHHyjmVt/Q5Blx8LD9P/ALc/nElOEkkkkpSSSSSmTGuse1jRLnEAAeJXpVdba621t+iwBo+AELkfqt0w5GUMyxv6HHMtPjYPof8Abf8AOLsElKSSSSUpJJJJT//UAkkkkpSSSSSlIeRj05NL6L2B9bxDmlESSU8d1P6q5eO51mGDkU8ho/nB8Wf4T/raxHsfW4ssaWOBgtIghemKNlddrdtjQ9vg4Aj8UlPmrGPscGMaXOPDWiT9y2+m/VbLyXNszAcajktP84fIM/wf/XF19dddbdtbQxvg0AD8FJJSPHx6callFDAytghrQiJJJKUkkkkpSSSSSn//1QJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkp//9YCSSSSlJJJJKUkkkkpSSSSSlJJJJKUkkkkpSSSSSlJJJJKf//ZADhCSU0EIQAAAAAAXQAAAAEBAAAADwBBAGQAbwBiAGUAIABQAGgAbwB0AG8AcwBoAG8AcAAAABcAQQBkAG8AYgBlACAAUABoAG8AdABvAHMAaABvAHAAIABDAEMAIAAyADAAMQA3AAAAAQA4QklNBAYAAAAAAAcACAEBAAEBAP/hDNhodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTM4IDc5LjE1OTgyNCwgMjAxNi8wOS8xNC0wMTowOTowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9IjlFQjU4Njk1MTQ0MjZBODlCN0YzMjkzQ0I0RTUxNzQ2IiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmM0NjJkMTI3LTMwNjctNDM5NC05ZDM5LWJlY2Q5MzYwYjQ3YSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSI5RUI1ODY5NTE0NDI2QTg5QjdGMzI5M0NCNEU1MTc0NiIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOC0xMC0wOVQxODoyNC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTgtMTAtMjlUMDE6MTI6MzMtMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTgtMTAtMjlUMDE6MTI6MzMtMDc6MDAiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpjNDYyZDEyNy0zMDY3LTQzOTQtOWQzOS1iZWNkOTM2MGI0N2EiIHN0RXZ0OndoZW49IjIwMTgtMTAtMjlUMDE6MTI6MzMtMDc6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE3IChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/+4AIUFkb2JlAGRAAAAAAQMAEAMCAwYAAAAAAAAAAAAAAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgMDAwMDAwMDAwMBAQEBAQEBAQEBAQICAQICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//CABEIAIAAgAMBEQACEQEDEQH/xACIAAEAAwEAAwEAAAAAAAAAAAAABQkKBgECBAcBAQAAAAAAAAAAAAAAAAAAAAAQAAICAwEBAQEAAAAAAAAAAAUGBAcwCAkgYIADEQACAwABAwMCBQMFAAAAAAADBAECBQYREgcAIRMwMSBgQRQVYYEyUXGRIiYSAQAAAAAAAAAAAAAAAAAAAID/2gAMAwEBAhEDEQAAAPycAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgwTgAAAAAORM7ZVyepaUaIjrgAAAAZuypsAFsJpHAAAAOdMRB8AAJE27nQAAAAhzEGRYAJg28kuAAAAZtSqEAFs5pBAAAABx5nhKvzwWimho7AAAAAAEQCXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgABBQD8Af/aAAgBAwABBQD8Af/aAAgBAQABBQD4diaFpQiLrOtN8PI+vihWCds31Ctezi82fNKy4M+aKmax9R7YrEmhPihZ6di6h7PELNs7xy52hnVnZuFvZYqWpz500vP8D58wTOUmWK5quBhBQ2hfLCiIIr4DCyLCWXwcFYA4epes0qs7T8ct9af72XZ+J/QE60k7ZXlnbFaTTIMwukgoQyzEtb+Wtr2aQQEBPq5OyHl8C0wAQAErwPh//9oACAECAgY/AAB//9oACAEDAgY/AAB//9oACAEBAQY/APyPV/lnIsPi6F691HeRayGKpevXp3VZ0mFg2r1/WLeraPE+Q4fKM+le673HdZDbTrXrEd1mc1hkNa9Z+82+ryDn/Pd1PjXEeLoTobOy981hLhkollwBAsI7br+g6wJZVcIyHZZLQQ62vesToYnhPU2PEHjgMyqq4jdNbyLyGRQQk6uhyRG7jnErWLWn7dXJLSaxa0GbN7dpndBll7QbMQzTjZSNttsG6RNiELM3vaenT3mZj/iPQHs9llHQUMM6rihbqtKnF1juEQU1vS0dZj2mJ/1/WPWbx/zlo6vl/wAdXrZY+m1VRnyTgV69B6SPImTKMcu7i90nW2SEYJSK/E2H3i3H+f8AAt1PkvEeUIRoY2yj81RMBgpVmAGAyIDaT+e6uVZpcwxnWZFcRK1vS0R9J7wbx17s8d+JdkqesAdB/wDpPKWesyjyNt0k2ko1+G0fJkpimns5+7L3XgtIF+DO8Fchevfx75c2IVygsUFEcf8AKLogoceczb1v810+ZURDkth7J6tymbvrAyVJ9HlHMXh1KlxPju1yVwV5mKkVws1nUYHaY6TFbhVmJ6fp6c09FkzujoNFbcaNPyHabaJYpS3n2ibEJaZnp/aPtH4U9XMZKho5rKziTYC/Gyq4qShgsr2jp0uMg4mPv7/09cZ5giOApcr4/jclTDWZmold3NW1Fx1meszFBNREf7fR3OM6PZ/H8ix9PCf+SkkH+z10j57XeOsTa9PgYt1iPeY9vWji6ixk9LJdczdBQ47hMBxE1gOLmreKEiRlHMTE9J/pH4czDylCvauxoqZmcosKxztOOkooksBekTe9rlJER0iZ94/vicazIpGbx7IzcPPilbUpCOSmFBSKVvEWrSAL16RPvEfSZ83cbzDzwDy5o3f2WRWEQGF5VcltrkibAYr8wVuXrLfywDXtb5HLODrFaCr+FXzdyHNJXgfiPTC7kHKMNF9/yimAJONLLUkkmsPhq567JzinrV+yY7xNbzMfS3+A8+wUuS8S5MjKGvkPQSKFHBBnXZWYAQLaGig2EZ1mQEGdc46EHetqxPrU5D4VV0PLvAO6rCuXnWGbyfhCtWPlTe4wNZWvL61N0GuXGkrZYmbEUFEenMXkGPoYWwgwRd3N1FGkHkTL2tQ4GU3B0NS1bVnrFoieselcfBy9Ha13j0AjlYyDenpNELbpAk0U6EKWetv8Yjr6zOR+aE3/AA/4+75ZZydC4xeS9tfpNxZ+bxcwnrcOpBJkRy7d6OCiIvRQ3WfWBwHgOClxriXGUaoZGQjBJGEckudhhhg5DNv6L7ZiHZZOQh2GCXIS9r2mfqzlcnxMjkeXMTE5u9mpa6ExNu+YlPQCwv0m3v8A4/f1/FcZxcjjuZ0iP47CzU8hDpW3dEfs88K6/SLR1j/r9/yR/9k=";
})();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let NextData = ( function() {

    return "data:image/jpeg;base64,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OEJJTQPzAAAAAAAJAAAAAAAAAAABADhCSU0nEAAAAAAACgABAAAAAAAAAAE4QklNA/UAAAAAAEgAL2ZmAAEAbGZmAAYAAAAAAAEAL2ZmAAEAoZmaAAYAAAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAQ4QklNBAIAAAAAAAoAAAAAAAAAAAAAOEJJTQQwAAAAAAAFAQEBAQEAOEJJTQQtAAAAAAAGAAEAAAAJOEJJTQQIAAAAAAAQAAAAAQAAAkAAAAJAAAAAADhCSU0EHgAAAAAABAAAAAA4QklNBBoAAAAAAz8AAAAGAAAAAAAAAAAAAACAAAAAgAAAAAUAYwBsAG8AcwBlAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAACAAAAAgAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAABAAAAABAAAAAAAAbnVsbAAAAAIAAAAGYm91bmRzT2JqYwAAAAEAAAAAAABSY3QxAAAABAAAAABUb3AgbG9uZwAAAAAAAAAATGVmdGxvbmcAAAAAAAAAAEJ0b21sb25nAAAAgAAAAABSZ2h0bG9uZwAAAIAAAAAGc2xpY2VzVmxMcwAAAAFPYmpjAAAAAQAAAAAABXNsaWNlAAAAEgAAAAdzbGljZUlEbG9uZwAAAAAAAAAHZ3JvdXBJRGxvbmcAAAAAAAAABm9yaWdpbmVudW0AAAAMRVNsaWNlT3JpZ2luAAAADWF1dG9HZW5lcmF0ZWQAAAAAVHlwZWVudW0AAAAKRVNsaWNlVHlwZQAAAABJbWcgAAAABmJvdW5kc09iamMAAAABAAAAAAAAUmN0MQAAAAQAAAAAVG9wIGxvbmcAAAAAAAAAAExlZnRsb25nAAAAAAAAAABCdG9tbG9uZwAAAIAAAAAAUmdodGxvbmcAAACAAAAAA3VybFRFWFQAAAABAAAAAAAAbnVsbFRFWFQAAAABAAAAAAAA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ZQAgAFAAaABvAHQAbwBzAGgAbwBwACAAQwBDACAAMgAwADEANwAAAAEAOEJJTQQGAAAAAAAHAAgBAQABAQD/4Q7JaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzEzOCA3OS4xNTk4MjQsIDIwMTYvMDkvMTQtMDE6MDk6MDEgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6OGM1ZWM1YjYtMTg0OS0xMTdjLWExMjktZDhhY2UxZjkwMThhIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjgyZmU5ZmQzLTdhMGEtNDZmZS05ZTRmLWQzYTQ0ZTNlNGZmZSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSIwREIyNkZCOEU1NDAxNERFQjYyRTdGODkwOUExMzA2MSIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxOC0xMC0wOVQyMTo0NDoxMC0wNzowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTgtMTAtMjRUMTE6NTA6MDEtMDc6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTgtMTAtMjRUMTE6NTA6MDEtMDc6MDAiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo1YzNiMTY4ZC1iOGQyLTRkYjMtYTdhMy1lYjc3N2VhNjM5NDYiIHN0RXZ0OndoZW49IjIwMTgtMTAtMjRUMTE6NTA6MDEtMDc6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE3IChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo4MmZlOWZkMy03YTBhLTQ2ZmUtOWU0Zi1kM2E0NGUzZTRmZmUiIHN0RXZ0OndoZW49IjIwMTgtMTAtMjRUMTE6NTA6MDEtMDc6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE3IChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8cGhvdG9zaG9wOkRvY3VtZW50QW5jZXN0b3JzPiA8cmRmOkJhZz4gPHJkZjpsaT5EQUM2MjI5RjVFQkU2OTIzQzQ2RDUwMDEwQzY1QTY0QjwvcmRmOmxpPiA8cmRmOmxpPkRCNjQxMTM4MzBENTQ3RTlGNEM5MTJBM0Y3QkFFOTIyPC9yZGY6bGk+IDxyZGY6bGk+YWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOmQ4Zjc3YTVjLWZkZjItMTE3Yi04ZTRiLTkzODAxNDMzYjRkODwvcmRmOmxpPiA8L3JkZjpCYWc+IDwvcGhvdG9zaG9wOkRvY3VtZW50QW5jZXN0b3JzPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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";
} )();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author lq3297401 / https://github.com/lq3297401
 */

let LastData = ( function() {

    return "data:image/jpeg;base64,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AB44QklNBBkAAAAAAAQAAAAeOEJJTQPzAAAAAAAJAAAAAAAAAAABADhCSU0nEAAAAAAACgABAAAAAAAAAAE4QklNA/UAAAAAAEgAL2ZmAAEAbGZmAAYAAAAAAAEAL2ZmAAEAoZmaAAYAAAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAM4QklNBAIAAAAAAAgAAAAAAAAAADhCSU0EMAAAAAAABAEBAQE4QklNBC0AAAAAAAYAAQAAAAg4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADPwAAAAYAAAAAAAAAAAAAAIAAAACAAAAABQBjAGwAbwBzAGUAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAIAAAACAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAEAAAAAAABudWxsAAAAAgAAAAZib3VuZHNPYmpjAAAAAQAAAAAAAFJjdDEAAAAEAAAAAFRvcCBsb25nAAAAAAAAAABMZWZ0bG9uZwAAAAAAAAAAQnRvbWxvbmcAAACAAAAAAFJnaHRsb25nAAAAgAAAAAZzbGljZXNWbExzAAAAAU9iamMAAAABAAAAAAAFc2xpY2UAAAASAAAAB3NsaWNlSURsb25nAAAAAAAAAAdncm91cElEbG9uZwAAAAAAAAAGb3JpZ2luZW51bQAAAAxFU2xpY2VPcmlnaW4AAAANYXV0b0dlbmVyYXRlZAAAAABUeXBlZW51bQAAAApFU2xpY2VUeXBlAAAAAEltZyAAAAAGYm91bmRzT2JqYwAAAAEAAAAAAABSY3QxAAAABAAAAABUb3AgbG9uZwAAAAAAAAAATGVmdGxvbmcAAAAAAAAAAEJ0b21sb25nAAAAgAAAAABSZ2h0bG9uZwAAAIAAAAADdXJsVEVYVAAAAAEAAAAAAABudWxs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ZABvAGIAZQAgAFAAaABvAHQAbwBzAGgAbwBwAAAAFwBBAGQAbwBiAGUAIABQAGgAbwB0AG8AcwBoAG8AcAAgAEMAQwAgADIAMAAxADcAAAABADhCSU0EBgAAAAAABwAIAQEAAQEA/+EOl2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxMzggNzkuMTU5ODI0LCAyMDE2LzA5LzE0LTAxOjA5OjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjEyZjZjOTYyLTE4NDktMTE3Yy1hMTI5LWQ4YWNlMWY5MDE4YSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowMWM3NTU4OS0yNTNmLTQ1MjUtYmIwNS1hMDU1MDljYzAxODQiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0iMERCMjZGQjhFNTQwMTRERUI2MkU3Rjg5MDlBMTMwNjEiIGRjOmZvcm1hdD0iaW1hZ2UvanBlZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9IiIgeG1wOkNyZWF0ZURhdGU9IjIwMTgtMTAtMDlUMjE6NDQ6MTAtMDc6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDE4LTEwLTI0VDExOjQ2OjM4LTA3OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDE4LTEwLTI0VDExOjQ2OjM4LTA3OjAwIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6NWI0MzQyMGMtZTQ0Ny00Y2IxLTllNGMtNzQ1NjFjODU1MWZkIiBzdEV2dDp3aGVuPSIyMDE4LTEwLTI0VDExOjQ2OjM4LTA3OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxNyAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MDFjNzU1ODktMjUzZi00NTI1LWJiMDUtYTA1NTA5Y2MwMTg0IiBzdEV2dDp3aGVuPSIyMDE4LTEwLTI0VDExOjQ2OjM4LTA3OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxNyAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPHBob3Rvc2hvcDpEb2N1bWVudEFuY2VzdG9ycz4gPHJkZjpCYWc+IDxyZGY6bGk+REFDNjIyOUY1RUJFNjkyM0M0NkQ1MDAxMEM2NUE2NEI8L3JkZjpsaT4gPHJkZjpsaT5hZG9iZTpkb2NpZDpwaG90b3Nob3A6ZDhmNzdhNWMtZmRmMi0xMTdiLThlNGItOTM4MDE0MzNiNGQ4PC9yZGY6bGk+IDwvcmRmOkJhZz4gPC9waG90b3Nob3A6RG9jdW1lbnRBbmNlc3RvcnM+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw/eHBhY2tldCBlbmQ9InciPz7/7gAhQWRvYmUAZEAAAAABAwAQAwIDBgAAAAAAAAAAAAAAAP/bAIQAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAwMDAwMDAwMDAwEBAQEBAQEBAQEBAgIBAgIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD/8IAEQgAgACAAwERAAIRAQMRAf/EAIgAAQACAgMBAAAAAAAAAAAAAAAECQgKAwYHBQEBAAAAAAAAAAAAAAAAAAAAABAAAgICAgMBAAAAAAAAAAAABQgEBjAHAQJQgAMJEQACAwACAgEBBwMFAAAAAAACBAEDBREGEgchMAAxIhMjJBZQMhRBYXFCRBIBAAAAAAAAAAAAAAAAAAAAgP/aAAwDAQECEQMRAAAA8nAAAAAAAAAAAAAAAAAAAABiSZbAAAAAAApLOgF+YAAAAAOMo+PNi/8AJ4AAAABCKKjqhf8AE8AAAAAglBxDL/CeAAAAADX2Ocv0JwAAAAABrWGVBdWAAAAAADrprnmUhdcAAAAAAD4JrymQxdkAAAAAAD5pr6HtZdkAAAAAACAUAHshdUAAAAAACAYBFhgAAAAAAAAAAAAAAAAAB//aAAgBAgABBQD0A//aAAgBAwABBQD0A//aAAgBAQABBQDxVbdTQln2xmeF5fnYOiGKZZrzcMnfv0+PR3Xm4tnVMExIbiIjh0ARAxzJkUdEdN6JGxe6VpXO3HPHDoAiBjIEIIiC6TtTtryksSubuGcOHQBEDI6rpztukEuSabteaPHwREHK3SlWRe7MkDydRHxzWqq128V1uFEsa8nkdebgNnstaBW8E3qandAE0ceXgDnLCBZ0W5iWE9GzkceXgDnIjoJeC56WkdMz0PdCbHnZiI6AXgUz88taUvdfhf/aAAgBAgIGPwAAf//aAAgBAwIGPwAAf//aAAgBAQEGPwD+lH6iyuwtnuG3Xl5W5KtVvUt/buuporxsLXWaYtYYMjjwM6aVreJ8TKeOfra3p701rifXy/ys3uvd82/8HYo+a2+u9fvqKfLr3PlU4xHMafPgP7HmXete7u0y7g9O6h2FHf68ZB+/7dv4WlB1Qt5CfGGm+tMMMffacSI/HkQ/UOy04CsIIyMuBAAH7+Z/2+2t6f8ATWqX8YIWM/uXdErDEuwgf6V2FhXQQwGEUc1tX/8AsifEf0+ZsV9keyV2871mi3NyithXLP8Ad9Ba+a7KFra+GacCo4kXGYmCsKJEZ+DIUsrKSUzcvNUXQz89BepRJBJSoV1UklVxqXUUUXqGuuusYEBiIiI4+fpsvvsrpppUXNOOt3VrKqrL1ldawxddI000U0xMnZzxERzPxHxoer/UOiyj0YZtU7H2ZebFm+2xMWVXIrc+F9HX+JnmeIO2fmY44iFfYvsRRvN9YZrYyiiQ2rudzdXvgLVlTr8SrwKiEq2WBmCtKJEeOCIUsrKSUzcvNUXQz89BepRJBJSoV1UklVxqXUUUXqGuuusYEBiIiI4+fpt6eo4rn52ete6++8zSokikrXNrTjjbJ1ULqrUDJ2GZQIjEzM/H2d9a+sHr871qlcVWrqVlas53JmkpmRiSkSqwqSmPFcogrZiJLjgRFT2N7FUbzvWSDQGgiUXLOdydXuGu1ZaA8WKcGoomthjmCsmJEZ+CIUsrKSUzcvNUXQz89BepRJBJSoV1UklVxqXUUUXqGuuusYEBiIiI4+fqPet/XTzKHrPOaKt5+srVme5OrXecss+cixTg1lESuvMQVhR5F9wjCXsn2ak1m+t07hsy8whtUb7ixQcV/peHixTg1HP6rETBWTEiMx+IhUzMtNXPzs9ahJBBFalRJFJWuKlU01FgqoXVWoGArABgRGIiI+PrW7GaLm5613nrpw+wGI235990EQYW9ZAiIaIRE/l2fEPxzPEFBRGR6d9w6Y05VIqZfS+5OEFNeVVXMUKYO8ciQhlCIfl0uFIgoMQFn4Jgg+tr9W7TkJ7mBuJ2oaeY/VJUNUFPx8/htouotGLKbq5GymwRsrKCiJ+xb+ALuz6z1W/LG3Y8pbxmLSLxx9khEJFsZifyziIgxj/SeYjJ9Oe5dbxxY/JQ6Z3bQtmAwI4gKMDevtmPHr4/FazE8DmcQB/seJR+tq9a7NlqbWFtqWI6Wa8EWLtL2R/YUf3AQFEGBjMHWcQQzBRE/azuHU4c2fV77P7fQ4k3esNWl+hnbBeMSYWTH6dkDEFEcTxMTEZPpr3JreOBEU5/S+66F0R/HojiujA3mLJiI60HxWszPxmcQB/seCR+s/i7SCmpk6il2foZ+hSDKjqbQTVcszTdBBbVcBcTE/f/AM/a/wBg+vqXdX1Y62RXj4nZodHcuv8ACpR2yRk7caw5gVmp+QLgS/6keT6a9ya3jgRFOf0vuuhdEfx6I4rowN5iyYiOtB8VrMz8ZnEAf7HgkfrO5WqkppZeiowhoZ769TaT6LdRLtpOqsDau2o2vaVdldgyJjMxMTE/Zn2L65Xdf9ZvNla2sP5zT/R32Lvy6VmbDH/Iuwrb5GtNiZkqimBOZ5Ei676I9mNNPq6LWZ1/132GSvbbzmGLKUMzqb4jM22ZJ+UVJWxEQgIxWfIeMh9Z3K1UlNLL0lGENDPfXqbSfSbqJdpJ1VgbV21G17SrsrsGRMZmJiefhX2vn7+uWNh7NHZes9ElcqqsfcUYocRtY7Dfouu6yOfeHkIEETz8SU8TE/0X/9k=";
} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let TextureProvider = ( function() {

	function getTexture( name ) {

		if ( name === "close" ) {

			return CloseData;

		} else if ( name === "add" ) {

			return PlusData;

		} else if ( name === "concatenate" ) {

			return ConcatenateData;

		} else if ( name === "subtract" ) {

			return SubtractData;

		} else if ( name === "multiply" ) {

			return MultiplyData;

		} else if ( name === "maximum" ) {

			return MaximumData;

		} else if ( name === "average" ) {

			return AverageData;

		} else if ( name === "dot" ) {

			return DotData;

		} else if ( name === "next" ) {

			return NextData;

		} else if ( name === "last" ) {

			return LastData;

		}

	}

	return {

		getTexture: getTexture

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

function CloseButton( size, unitLength, position, color, minOpacity ) {

	this.size = size;
	this.thickness = 2 * unitLength;
	this.unitLength = unitLength;
	this.minOpacity = minOpacity;

	this.position = {

		x: position.x,
		y: position.y,
		z: position.z

	};

	this.color = color;

	this.button = undefined;

	this.init();

}

CloseButton.prototype = {

	init: function() {

		let texture = new THREE.TextureLoader().load( TextureProvider.getTexture( "close" ) );

		let materialSide = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let materialTop = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: texture,
			transparent: true

		} );

		let materials = [];

		materials.push( materialSide );
		materials.push( materialTop );
		materials.push( materialTop );

		let cylinderRadius = this.size;

		let geometry = new THREE.CylinderBufferGeometry( cylinderRadius, cylinderRadius, this.thickness, 32 );
		let cylinderButton = new THREE.Mesh( geometry, materials );

		cylinderButton.position.set( this.position.x, this.position.y, this.position.z );
		cylinderButton.clickable = true;
		cylinderButton.hoverable = true;
		cylinderButton.elementType = "closeButton";
		cylinderButton.rotateY( - Math.PI / 2 );

		this.button = cylinderButton;

	},

	getElement: function() {

		return this.button;

	},

	setLayerIndex: function( layerIndex ) {

		this.button.layerIndex = layerIndex;

	},

	setPositionedLayer: function( layerType ) {

		this.button.positionedLayer = layerType;

	},

	updatePos: function( pos ) {

		this.position.x = pos.x;
		this.position.y = pos.y;
		this.position.z = pos.z;
		this.button.position.set( this.position.x, this.position.y, this.position.z );

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

let LayerTranslateFactory = ( function() {

	function translate( layer, targetCenter, translateTime ) {

		let init = {

			ratio: 0

		};
		let end = {

			ratio: 1

		};

		let startPos = layer.center;

		let translateTween = new TWEEN.Tween( init )
			.to( end, translateTime );

		translateTween.onUpdate( function() {

			let pos = {

				x: init.ratio * ( targetCenter.x - startPos.x ) + startPos.x,
				y: init.ratio * ( targetCenter.y - startPos.y ) + startPos.y,
				z: init.ratio * ( targetCenter.z - startPos.z ) + startPos.z

			};

			layer.neuralGroup.position.set( pos.x, pos.y, pos.z );

		} ).onStart( function() {

		} ).onComplete( function() {

			layer.center = {

				x: targetCenter.x,
				y: targetCenter.y,
				z: targetCenter.z

			};

		} );

		translateTween.start();

	}

	return {

		translate: translate

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

/**
 * Layer, abstract layer, should not be initialized directly.
 * Base class for NativeLayer, MergedLayer
 *
 * @param config, customized configuration for Layer
 * @constructor
 */

function Layer( config ) {

	/**
	 * scene object of THREE.js.
	 *
	 * @type { THREE.Scene }
	 */

	this.scene = undefined;

	/**
	 * Order index number of the layer in model.
	 *
	 * @type { number }
	 */

	this.layerIndex = undefined;

	/**
	 * The center (x, y, z) coordinates of the layer, related to the model.
	 *
	 * @type { Object } {x: double, y: double, z: double}
	 */

	this.center = undefined;

	/**
	 * last layer in model relative to this layer.
	 *
	 * @type { Layer }
	 */

	this.lastLayer = undefined;

	/**
	 * Store all neural value as an array.
	 * "undefined" means no value.
	 *
	 * @type { double[] }
	 */

	this.neuralValue = undefined;

	/**
     * Important property
     * Shape describes input and output dimensions of the layer.
	 *
	 * @type { Array }
	 */

	this.inputShape = [];
	this.outputShape = [];

	/**
     * Wrapper object represented the layer object in scene.
     * All Three.js objects within the layer should be added to neuralGroup.
	 *
	 * @type { THREE.Object }
	 */

	this.neuralGroup = undefined;

	/**
     * Color of the layer for visualization.
	 *
	 * @type { HEX }
	 */

	this.color = undefined;

	/**
	 * Handler for layer aggregation.
	 *
	 * @type { Object }
	 */

	this.aggregationHandler = undefined;

	/**
	 * Handler for close button.
	 *
	 * @type { Object }
	 */

	this.closeButtonHandler = undefined;

	/**
	 * Config to control whether to show close button.
	 * true -- show close button when layer is open.
	 * false -- never show close button.
	 *
	 * @type { boolean }
	 */

	this.hasCloseButton = true;

	/**
     * Config of close button size.
     * Close button size is multiplied by the ratio number
	 *
	 * @type { number }
	 */

	this.closeButtonSizeRatio = 1;

	/**
	 * Minimum opacity of the layer.
	 *
	 * @type { double } [0, 1]
	 */

	this.minOpacity = undefined;

	/**
	 * Width and height in Three.js scene.
     * actualWidth = unitLength * width
	 * (1d layer and 2d layer do not have actualHeight).
	 *
	 * @type { double }
	 */

	this.actualWidth = undefined;
	this.actualHeight = undefined;

	/**
	 * Depth of the layer object in the scene.
	 *
	 * @type { double }
	 */

	this.actualDepth = undefined;

	/**
	 * Unit length used to render layer object.
	 *
	 * If the layer is not the first layer in model, value is from last layer.
	 * this.unitLength = this.lastLayer.unitLength;
	 *
	 * If layer is the first layer in model, checkout input layer for more information.
	 * this.unitLength = this.actualWidth / this.width;
	 *
	 * @type { double }
	 */

	this.unitLength = undefined;

	/**
	 * Handler for object which is showing text.
	 *
	 * @type { Object }
	 */

	this.textElementHandler = undefined;

	/**
	 * Handler for line group.
	 *
	 * @type { Object }
	 */

	this.lineGroupHandler = undefined;

	/**
	 * Config to control showing text in layer.
	 *
	 * @type { boolean }
	 */

	this.textSystem = undefined;

	/**
	 * Config of whether show relation line or not.
     * true -- show relation lines.
     * false -- do not show relation lines.
	 *
	 * @type { boolean }
	 */

	this.relationSystem = undefined;

	/**
	 * Layer status on whether the layer is expanded or collapsed.
	 * true -- expanded;
	 * false -- collapsed.
	 *
	 * @type { boolean }
	 */

	this.isOpen = undefined;

	/**
     * Config on the speed of layer expansion and collapsion.
	 *
	 * @type { number }
	 */

	this.animationTimeRatio = 1;
	this.openTime = OpenTime;
	this.separateTime = SeparateTime;

	/**
     * Whether the layer is a group or not.
	 *
	 * @type { boolean }
	 */

	this.isGroup = false;

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * For example, YoloGrid can automatically detect the output from last layer,
	 * users do not need to add value for YoloGrid value when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = undefined;

	/**
	 * name of the layer.
	 *
	 * @type { String }
	 */

	this.name = undefined;

	/**
	 * Type of layer, each layer class has a specific layerType.
	 * For example, "Conv2d", "Pooling2d".
	 *
	 * @type { String }
	 */

	this.layerType = undefined;

	// Load layer config.

	this.loadBasicLayerConfig( config );

}

Layer.prototype = {

	/**
	 * loadBasicLayerConfig() Load layer config.
     * execute while initialization
	 *
	 * @param { JSON } config, layer config.
	 */

	loadBasicLayerConfig: function( config ) {

		if ( config !== undefined ) {

			if ( config.initStatus !== undefined ) {

				if ( config.initStatus === "open" ) {

					this.isOpen = true;

				} else if ( config.initStatus === "close" ) {

					this.isOpen = false;

				} else {

					console.error( "\"initStatus\" property do not support for " + config.initStatus + ", use \"open\" or \"close\" instead." );

				}

			}

			if ( config.color !== undefined ) {

				this.color = config.color;

			}

			if ( config.name !== undefined ) {

				this.name = config.name;

			}

			if ( config.closeButton !== undefined ) {

				if ( config.closeButton.display !== undefined ) {

					this.hasCloseButton = config.closeButton.display;

				}

				if ( config.closeButton.ratio !== undefined ) {

					this.closeButtonSizeRatio = config.closeButton.ratio;

				}

			}

			if ( config.animationTimeRatio !== undefined ) {

				if ( config.animationTimeRatio > 0 ) {

					this.animationTimeRatio = config.animationTimeRatio;

				}

				this.openTime *= this.animationTimeRatio;
				this.separateTime *= this.animationTimeRatio;

			}

			if ( config.minOpacity !== undefined ) {

				this.minOpacity = config.minOpacity;

			}

		}

	},

	/**
	 * loadBasicLayerConfig() Load model config for layers. Model execute before "assemble".
	 *
	 * @param { JSON } modelConfig, model config, including default and customized model config.
	 */

	loadBasicModelConfig: function( modelConfig ) {

		if ( this.isOpen === undefined ) {

			this.isOpen = modelConfig.layerInitStatus;

		}

		if ( this.relationSystem === undefined ) {

			this.relationSystem = modelConfig.relationSystem;

		}

		if ( this.textSystem === undefined ) {

			this.textSystem = modelConfig.textSystem;

		}

		if ( this.minOpacity === undefined ) {

			this.minOpacity = modelConfig.minOpacity;

		}

		this.openTime *= modelConfig.animationTimeRatio;
		this.separateTime *= modelConfig.animationTimeRatio;

	},

	/**
	 * setLastLayer(), hold reference for last layer.
	 *
	 * @param { Layer } layer, reference of last layer which positioned before current layer in model.
	 */

	setLastLayer: function( layer ) {

		this.lastLayer = layer;

	},

	/**
	 * setEnvironment(), hold ref of THREE.js scene and model
	 *
	 * @param { THREE.Object } scene, THREE.js scene.
	 * @param { Model } model, the model object current layer be added.
	 */

	setEnvironment: function( scene, model ) {

		this.scene = scene;
		this.model = model;

	},

	/**
	 * initCloseButton() init close button, add to neural group, and store close button handler.
	 */

	initCloseButton: function() {

		if ( this.hasCloseButton ) {

			// Get close button metrics.

			let closeButtonPos = this.calcCloseButtonPos();
			let closeButtonSize = this.closeButtonSizeRatio * this.calcCloseButtonSize();

			// Create close button element.

			let closeButtonHandler = new CloseButton(

				closeButtonSize,
				this.unitLength,
				closeButtonPos,
				this.color,
				this.minOpacity

			);

			// Set layer information to close button.

			closeButtonHandler.setLayerIndex( this.layerIndex );

			// Store close button handler and add actual Close button element to neuralGroup.

			this.closeButtonHandler = closeButtonHandler;
			this.neuralGroup.add( this.closeButtonHandler.getElement() );

		}

	},

	/**
	 * disposeCloseButton() remove close button element, clear handler.
	 */

	disposeCloseButton: function() {

		this.neuralGroup.remove( this.closeButtonHandler.getElement() );
		this.closeButtonHandler = undefined;

	},

	/**
	 * translateLayer(), translate layer to a target center.
	 *
	 * @param targetCenter, target center the layer is moving to
	 * @param translateTime, animation time
	 */

	translateLayer: function( targetCenter, translateTime ) {

		// LayerTranslateFactory handles actual translate animation, checkout "LayerTranslateTween.js" for more information.

		LayerTranslateFactory.translate( this, targetCenter, translateTime );

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Layer.
	 * SubClasses ( specific layers ) override these abstract methods.
	 *
	 * ============
	 */

	/**
	 * init() abstract method
	 * Initialize THREE.Object in Layer, warp them into a group, and add to THREE.js scene.
	 *
	 * Model passes two parameters, center and actualDepth.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function(center, actualDepth ) {

	},

	/**
	 * assemble() abstract method
	 * Configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * Override this function to get information from previous layer
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

	},

	/**
	 * updateValue() abstract method
	 * Accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * Override this function to implement layer's own value update strategy.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

	},

	/**
	 * clear() abstract method
	 * Clear data and visualization in layer.
	 *
	 * Override this function to implement layer's own clear function.
	 */

	clear: function() {

	},

	/**
	 * handleClick() abstract method
	 * Event callback, if clickable element in this layer is clicked, execute this handle function.
	 *
	 * Override this function if layer has any clicked event.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

	},

	/**
	 * handleHoverIn() abstract method
	 * Event callback, if hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * Override this function if layer has any hover event.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

	},

	/**
	 * handleHoverOut() abstract method
	 * Event callback, called by model if mouse hover out of this layer.
	 *
	 * Override this function if layer has some hover event.
	 */

	handleHoverOut: function() {

	},

	/**
	 * loadModelConfig() abstract method
	 * Load model's configuration into layer object.
	 *
	 * Override this function if there are some specific model configurations for layer.
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

	},

	/**
	 * calcCloseButtonSize() abstract method
	 * Called by initCloseButton function in abstract class "Layer", get close button size.
	 *
	 * Override this function to implement layer's own button size calculation strategy.
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		return  1;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() abstract method
	 * Called by initCloseButton function in abstract class "Layer", get close button position.
	 *
	 * Override this function to implement layer's own button position calculation strategy.
	 *
	 * @return { Object } close button position, { x: double, y: double, z: double }, relative to layer.
	 */

	calcCloseButtonPos: function() {

		return {

			x: 0,
			y: 0,
			z: 0

		};

	},

	/**
	 * getBoundingWidth(), abstract layer
	 *
	 * Override this function to provide layer's bounding width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		return 100;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * BasicLineGroupController, abstract layer, can not be initialized by TensorSpace user.
 * Line group component for abstract layer "Layer"
 *
 * @returns BasicLineGroup object
 */

function BasicLineGroup( layer, scene, neuralGroup, color, minOpacity ) {

	this.layer = layer;
	this.scene = scene;
	this.neuralGroup = neuralGroup;
	this.color = color;
	this.minOpacity = minOpacity;

	// actual relative lines element for layer

	this.lineGroup = undefined;

	this.init();

}

BasicLineGroup.prototype = {

	init: function() {

		let lineMat = new THREE.LineBasicMaterial( {

			opacity: this.minOpacity,
			transparent: true,
			vertexColors: THREE.VertexColors

		} );

		let lineGeom = new THREE.Geometry();
		lineGeom.dynamic = true;
		this.lineGroup = new THREE.Line( lineGeom, lineMat );

	},

	getLineGroupParameters: function( selectedElement ) {

		this.scene.updateMatrixWorld();

		let lineColors = [];
		let lineVertices = [];

		let relatedElements = this.layer.getRelativeElements( selectedElement );

		let neuralGroupPos = new THREE.Vector3();

		this.neuralGroup.getWorldPosition( neuralGroupPos );

		let globalStartPos = new THREE.Vector3();

		selectedElement.getWorldPosition( globalStartPos );

		let lineStartPos = globalStartPos.sub( neuralGroupPos );

		for ( let i = 0; i < relatedElements.length; i ++ ) {

			lineColors.push( new THREE.Color( this.color ) );
			lineColors.push( new THREE.Color( this.color ) );

			let globalRelativePos = new THREE.Vector3();
			relatedElements[ i ].getWorldPosition( globalRelativePos );

			lineVertices.push( globalRelativePos.sub( neuralGroupPos  ) );
			lineVertices.push( lineStartPos );

		}

		return {

			lineColors: lineColors,
			lineVertices: lineVertices

		}

	},

	showLines: function( selectedElement ) {

		let lineGroupParameters = this.getLineGroupParameters( selectedElement );

		let geometry = new THREE.Geometry( {

			transparent:true,
			opacity: this.minOpacity

		} );

		geometry.colors = lineGroupParameters.lineColors;
		geometry.vertices = lineGroupParameters.lineVertices;
		geometry.colorsNeedUpdate = true;
		geometry.verticesNeedUpdate = true;

		this.lineGroup.geometry = geometry;
		this.lineGroup.material.needsUpdate = true;

		this.neuralGroup.add( this.lineGroup );

	},

	hideLines: function() {

		this.lineGroup.geometry.dispose();
		this.neuralGroup.remove( this.lineGroup );

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

/**
 * NativeLayer, abstract layer, should not be initialized directly.
 * NativeLayer inherits from "Layer".
 * NativeLayer extends "Layer" to include basic line group.
 * Base class for:
 *      NativeLayer1d, NativeLayer2d, NativeLayer3d,
 *      Input1d, GreyscaleInput, RGBInput,
 *      Output1d, Output2d,
 *      OutputDetection, YoloGrid.
 *
 * @param config, user's configuration for NativeLayer.
 * @constructor
 */

function NativeLayer( config ) {

	// NativeLayer inherits from abstract layer "Layer"

	Layer.call( this, config );

	/**
	 * Hold handler for line group.
	 *
	 * @type { Object }
	 */

	this.lineGroupHandler = undefined;

	/**
	 * Identify whether layer is a merged layer or not.
     * If it's a NativeLayer, "isMerged" is always false.
	 *
	 * @type {boolean}
	 */

	this.isMerged = false;

}

NativeLayer.prototype = Object.assign( Object.create( Layer.prototype ), {

	/**
	 * addLineGroup() adds basic line group element to layer and holds the handler.
	 */

	addLineGroup: function() {

		this.lineGroupHandler = new BasicLineGroup(

			this,
			this.scene,
			this.neuralGroup,
			this.color,
			this.minOpacity

		);

	},

	/**
	 * Connect to last layer.
	 *
	 * @param lastLayer
	 */

	apply: function( lastLayer ) {

		this.lastLayer = lastLayer;

	},

	/**
	 * ============
	 *
	 * Functions below are abstract for Layer.
	 * SubClasses ( specific layers ) override these abstract functions to get Layer's features.
	 *
	 * ============
	 */

	/**
	 * init() abstract method
	 * Create actual THREE.Object, wrap them into a group, and add to THREE.js scene.
	 *
	 * Model passes two parameters, center and actualDepth, to Layer when call init() to initialize Layer.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function(center, actualDepth ) {

	},

	/**
	 * assemble() abstract method
	 * Configure layer index in the model
     * Calculate the shape and parameters based on previous layer.
	 *
	 * Override this function to get information from previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

	},

	/**
	 * updateValue() abstract method
	 * Accept layer output value from model, update layer visualization if necessary.
	 *
	 * Model passes layer output value to layer through updateValue method.
	 *
     * Override for customized layer update strategy.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

	},

	/**
	 * clear() abstract method
	 * Clear data and visualization in layer.
	 *
     * Override for customized layer clean up.
	 */

	clear: function() {

	},

	/**
	 * handleClick() abstract method
     * Event callback, be executed if any clickable element is clicked.
	 *
     * Override for any clicked event required.
	 *
	 * @param { THREE.Object } clickedElement, clicked element from Raycaster.
	 */

	handleClick: function( clickedElement ) {

	},

	/**
	 * handleHoverIn() abstract method
     * Event callback, be executed if any hoverable element is detected by Raycaster.
	 *
	 * Override for any hover event required.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element from Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

	},

	/**
	 * handleHoverOut() abstract method.
     * Event callback, called when mouse hover out.
	 *
     * Override for any hover out event required.
	 */

	handleHoverOut: function() {

	},

	/**
	 * loadModelConfig() abstract method.
     * Load model configurations to layer object.
	 *
     * Override for any customized model configurations for layer.
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

	},

	/**
	 * calcCloseButtonSize() abstract method.
     * Called for providing close button size to initCloseButton in "Layer".
	 *
     * Override for customized button size calculation strategy.
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		return  1;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() abstract method
     * Called for providing close button position to initCloseButton in "Layer".
	 *
     * Override for customized button position calculation strategy.
	 *
	 * @return { Object } close button position, { x: double, y: double, z: double }, relative to layer position.
	 */

	calcCloseButtonPos: function() {

		return {
			x: 0,
			y: 0,
			z: 0
		};

	},

	/**
	 * ============
     *
     * Since NativeLayer adds basic line group based on "Layer",
     * it is required to implement "getRelativeElements" and "provideRelativeElements" to enable line system.
	 *
	 * ============
	 */

	/**
	 * getRelativeElements() abstract function
	 * Get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Override this function to define relative element from previous layer.
     * Override to define relative element from previous layer.
	 *
	 * Bridge design patten:
	 * 1. "getRelativeElements" request for relative elements from previous layer;
	 * 2. "provideRelativeElements" of previous layer response to request, returns relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by Raycaster
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		return [];

	},

	/**
	 * provideRelativeElements() abstract function
	 * Return relative elements.
	 *
	 * Override this function to return relative elements based on request information.
     * Override to return relative elements based on request.
	 *
     * Bridge design patten:
     * 1. "getRelativeElements" request for relative elements from previous layer;
     * 2. "provideRelativeElements" of previous layer response to request, returns relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: THREE.Object[] }
	 */

	provideRelativeElements: function( request ) {

		return {

			isOpen: this.isOpen,
			elementList: []

		};

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * NativeLayer2d, abstract layer, can not be initialized by TensorSpace user.
 * Base class for Activation2d, BasicLayer2d, Conv1d, Cropping1d, GlobalPooling1d, padding1d, Pooling1d, Reshape1d, UpSampling1d.
 * The characteristic for classes which inherit from NativeLayer2d is that their output shape has one dimension, for example, [ width, depth ].
 *
 * @param config, user's configuration for NativeLayer2d.
 * @constructor
 */

function NativeLayer2d(config ) {

	// NativeLayer2d inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * NativeLayer2d has one output dimensions: [ width, depth ].
	 *
	 * @type { int }
	 */

	this.width = undefined;
	this.depth = undefined;

	/**
	 * grid lines' handlers list
	 *
	 * @type { Array }
	 */

	this.queueHandlers = [];

	/**
	 * grid lines' centers when layer is closed.
	 *
	 * @type { Array }
	 */

	this.closeCenterList = [];

	/**
	 * grid lines' centers when layer is totally open.
	 *
	 * @type { Array }
	 */

	this.openCenterList = [];

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * False means that user need to add value for NativeLayer2d when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	this.layerDimension = 2;

}

NativeLayer2d.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * NativeLayer2d overrides NativeLayer's function:
	 * init, updateValue, clear, handleClick, handleHoverIn, handleHoverOut,
	 * calcCloseButtonSize, calcCloseButtonPos, provideRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in NativeLayer2d, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to NativeLayer2d when call init() to initialize NativeLayer2d.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in NativeLayer2d.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		// depth === 1 means that there is only one grid line in NativeLayer2d, no need for aggregation, open layer, or close layer.

		if ( this.depth === 1 ) {

			// Open layer and init one grid line (depth === 1) without initializing close button.

			this.isOpen = true;
			this.initSegregationElements( this.openCenterList );

		} else {

			if ( this.isOpen ) {

				// Init all grid lines and display them to totally opened positions.

				this.initSegregationElements( this.openCenterList );

				// Init close button.

				this.initCloseButton();

			} else {

				// Init aggregation when layer is closed.

				this.initAggregationElement();

			}

		}

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

		// Create relative line element.

		this.addLineGroup();

	},

	/**
	 * updateValue() accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

		// Store layer output value in "neuralValue" attribute, this attribute can be get by TensorSpace user.

		this.neuralValue = value;

		if ( this.isOpen ) {

			// If layer is open, update queues' visualization.

			this.updateSegregationVis();

		} else {

			// If layer is closed, update aggregation's visualization.

			this.updateAggregationVis();

		}

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

			// Use handlers to clear visualization.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.queueHandlers.length; i ++ ) {

					this.queueHandlers[ i ].clear();

				}

			} else {

				this.aggregationHandler.clear();

			}

			// Clear layer data.

			this.neuralValue = undefined;

		}

	},

	/**
	 * handleClick() If clickable element in this layer is clicked, execute this handle function.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

		if ( clickedElement.elementType === "aggregationElement" ) {

			// If aggregation element is clicked, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If close button is clicked, close layer.

			this.closeLayer();

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If relationSystem is enabled, show relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.showLines( hoveredElement );

		}

		// If textSystem is enabled, show hint text, for example, show grid line length.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}
	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If relationSystem is enabled, hide relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.hideLines();

		}

		// If textSystem is enabled, hide hint text, for example, hide grid line length.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * calcCloseButtonSize() get close button size.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		return 1.1 * this.unitLength;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() get close button position.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { JSON } position, close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		return {

			x: - this.actualWidth / 2 - 30,
			y: 0,
			z: 0

		};

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		if ( request.all !== undefined && request.all ) {

			// When "all" attribute in request is true, return all elements displayed in this layer.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.queueHandlers.length; i ++ ) {

					relativeElements.push( this.queueHandlers[ i ].getElement() );

				}

			} else {

				relativeElements.push( this.aggregationHandler.getElement() );

			}

		} else {

			if ( request.index !== undefined ) {

				if ( this.isOpen ) {

					// If index attribute is set in request, and layer is open, return grid line element which has the same index.

					relativeElements.push( this.queueHandlers[ request.index ].getElement() );

				} else {

					// If layer is closed, return aggregation element.

					relativeElements.push( this.aggregationHandler.getElement() );

				}

			}

		}

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			return this.actualWidth / 2 - this.calcCloseButtonPos().x + this.calcCloseButtonSize();

		} else {

			return this.actualWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * openLayer() open NativeLayer2d, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			// QueueGroupTweenFactory handles actual open animation, checkout "QueueGroupTransitionTween.js" for more information.

			QueueGroupTweenFactory.openLayer( this );

			this.isOpen = true;

		}

	},

	/**
	 * closeLayer() close NativeLayer2d, switch layer status from "open" to "close".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			// QueueGroupTweenFactory handles actual close animation, checkout "QueueGroupTransitionTween.js" for more information.

			QueueGroupTweenFactory.closeLayer( this );

			this.isOpen = false;

		}

	},

	/**
	 * initSegregationElements() create grid lines's THREE.js Object, configure them, and add them to neuralGroup in NativeLayer2d.
	 *
	 * @param { JSON[] } centers, list of grid lines' center (x, y, z), relative to layer
	 */

	initSegregationElements: function( centers ) {

		this.queueHandlers = [];

		for ( let i = 0; i < this.depth; i ++ ) {

			// GridLine Object is a wrapper for grid line elements, checkout "GridLine.js" for more information.

			let queueHandler = new GridLine(

				this.width,
				this.unitLength,
				centers[ i ],
				this.color,
				this.minOpacity

			);

			// Set layer index to feature map, feature map object can know which layer it has been positioned.

			queueHandler.setLayerIndex( this.layerIndex );

			// Set queue index.

			queueHandler.setGridIndex( i );

			// Store handler for queue for latter use.

			this.queueHandlers.push( queueHandler );

			// Get actual THREE.js element and add it to layer wrapper Object.

			this.neuralGroup.add( queueHandler.getElement() );

		}

		// Update all queues' visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateSegregationVis();

		}

	},

	/**
	 * disposeSegregationElements() remove grid lines from neuralGroup, clear their handlers, and dispose their THREE.js Object in NativeLayer2d.
	 */

	disposeSegregationElements: function() {

		for ( let i = 0; i < this.depth; i ++ ) {

			// Remove queues' THREE.js object from neuralGroup.

			this.neuralGroup.remove( this.queueHandlers[ i ].getElement() );

		}

		// Clear handlers, actual objects will automatically be GC.

		this.queueHandlers = [];

	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in NativeLayer2d.
	 */

	initAggregationElement: function() {

		// GridAggregation Object is a wrapper for queues' aggregation, checkout "GridAggregation.js" for more information.

		let aggregationHandler = new GridAggregation(

			this.width,
			this.unitLength,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, aggregation object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( this.aggregationHandler.getElement() );

		// Update aggregation's visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateAggregationVis();

		}

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in NativeLayer2d.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * updateAggregationVis() update feature maps' aggregation's visualization.
	 */

	updateAggregationVis: function() {

		// Generate aggregation data from layer's raw output data. Checkout "ChannelDataGenerator.js" for more information.

		let aggregationUpdateValue = ChannelDataGenerator.generateAggregationData(

			this.neuralValue,
			this.depth,
			this.aggregationStrategy

		);

		// Get colors to render the surface of aggregation.

		let colors = ColorUtils.getAdjustValues( aggregationUpdateValue, this.minOpacity );

		// aggregationHandler execute update visualization process.

		this.aggregationHandler.updateVis( colors );

	},

	/**
	 * updateSegregationVis() grid lines' visualization.
	 */

	updateSegregationVis: function() {

		// Generate grid line data from layer's raw output data. Checkout "ChannelDataGenerator.js" for more information.

		let layerOutputValues = ChannelDataGenerator.generateChannelData( this.neuralValue, this.depth );

		let gridLineLength = this.width;

		// Each grid line handler execute its own update function.

		for ( let i = 0; i < this.depth; i ++ ) {

			// Get colors to render the surface of grid lines.

			let colors = ColorUtils.getAdjustValues(

				layerOutputValues.slice( i * gridLineLength, ( i + 1 ) * gridLineLength ),
				this.minOpacity

			);

			this.queueHandlers[ i ].updateVis( colors );

		}

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		if ( element.elementType === "gridLine" ) {

			let gridIndex = element.gridIndex;

			this.queueHandlers[ gridIndex ].showText();
			this.textElementHandler = this.queueHandlers[ gridIndex ];

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for NativeLayer2d.
	 * SubClasses ( specific layers ) override these abstract method to get NativeLayer2d's characters.
	 *
	 * ============
	 */

	/**
	 * loadModelConfig() abstract method
	 * Load model's configuration into layer object.
	 *
	 * Override this function if there are some specific model configurations for layer.
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model.
	 */

	loadModelConfig: function( modelConfig ) {

	},

	/**
	 * assemble() abstract method
	 * Configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * Override this function to get information from previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model.
	 */

	assemble: function( layerIndex ) {

	},

	/**
	 * getRelativeElements() abstract method
	 * Get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Override this function to define relative element from previous layer.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		return [];

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

let QueueCenterGenerator = ( function() {

	function getCenterList( actualLength, number ) {

		let centerList = [];

		let interval = GridIntervalRatio * actualLength;

		let initZTranslation = - interval * ( number - 1 ) / 2;

		for ( let i = 0; i < number; i ++ ) {

			let center = {

				x: 0,
				y: 0,
				z: initZTranslation + interval * i

			};

			centerList.push( center );

		}

		return centerList;

	}

	return  {

		getCenterList: getCenterList

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 1D Convolution.
 *
 * @param config, user's configuration for Conv1d layer
 * @constructor
 */

function Conv1d( config ) {

	// "Conv1d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	/**
	 * The depth of the layer output.
	 *
	 * @type { int }
	 */

	this.filters = undefined;

	/**
	 * The strides length of the convolution.
	 *
	 * @type { int }
	 */

	this.strides = undefined;

	/**
	 * The width of the convolution window.
	 *
	 * @type { int }
	 */

	this.kernelSize = undefined;

	/**
	 * Padding mode.
	 * "valid" or "same", default to "valid".
	 *
	 * @type { string }
	 */

	this.padding = "valid";

	/**
	 * Whether user directly define the layer shape.
	 * Set "true" if Conv1d's shape is predefined by user.
	 *
	 * @type { boolean }
	 */

	this.isShapePredefined = false;

	// Load user's Conv1d configuration.

	this.loadLayerConfig( config );

	// Init close grid line centers.

	for ( let i = 0; i < this.depth; i ++ ) {

		let center = {

			x: 0,
			y: 0,
			z: 0

		};

		this.closeCenterList.push( center );

	}

	this.layerType = "Conv1d";

}

Conv1d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * Conv1d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// If user's do not define a specific shape for layer, infer layer output shape from input shape and config.

		if ( !this.isShapePredefined ) {

			// Two padding mode is the same as TensorFlow

			if ( this.padding === "valid" ) {

				// ceil[ ( W - F + 1 ) / S ]

				this.width = Math.ceil( ( this.inputShape[ 0 ] - this.kernelSize + 1 ) / this.strides );

			} else if ( this.padding === "same" ) {

				// ceil( W / S )

				this.width = Math.ceil( this.inputShape[ 0 ] / this.strides );

			}

		}

		// Conv1d layer's outputShape has two dimension, that's why Conv1d layer inherits from abstract layer "NativeLayer2d".

		this.outputShape = [ this.width, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate the grid line centers for open status.

		this.openCenterList = QueueCenterGenerator.getCenterList( this.actualWidth, this.depth );

	},

	/**
	 * loadModelConfig() load model's configuration into Conv1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.conv1d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "gridLine" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Conv1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Conv1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "filters" configuration is required.

			if ( layerConfig.filters !== undefined ) {

				this.filters = layerConfig.filters;
				this.depth = layerConfig.filters;

			} else {

				console.error( "\"filters\" property is required for conv1d layer." );

			}

			// Optional configuration.

			if ( layerConfig.strides !== undefined ) {

				this.strides = layerConfig.strides;

			}

			if ( layerConfig.kernelSize !== undefined ) {

				this.kernelSize = layerConfig.kernelSize;

			}

			// Load padding mode, accept two mode: "valid" and "same", support both uppercase and lowercase.

			if ( layerConfig.padding !== undefined ) {

				if ( layerConfig.padding.toLowerCase() === "valid" ) {

					this.padding = "valid";

				} else if ( layerConfig.padding.toLowerCase() === "same" ) {

					this.padding = "same";

				} else {

					console.error( "\"padding\" property do not support for " + layerConfig.padding + ", use \"valid\" or \"same\" instead." );

				}

			}

			// Load user's predefined shape.

			if ( layerConfig.shape !== undefined ) {

				this.isShapePredefined = true;
				this.width = layerConfig.shape[ 0 ];

			}

		} else {

			console.error( "Lack config for conv1d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

let MathUtils = (function() {

	function getMaxSquareRoot( n ) {

		let sqrt = Math.sqrt( n );

		if ( Math.floor( sqrt ) === sqrt ) {

			return sqrt;

		} else {

			return Math.floor( sqrt ) + 1;

		}

	}

    function getClosestTwoFactors( n ) {

	    let sqrt = Math.sqrt( n );
	    let base = sqrt;
	    let limit = Math.floor( Math.sqrt( n / 2 ) );      // force maximum width:height < 2:1

	    if ( Math.floor( base ) === sqrt ) {    // perfect square

			return [ base, base ];

        } else {

	        base = Math.floor( base );

	        while ( n % base !== 0 && base > limit ) {

	            base --;

            }

            if ( Math.floor( n /base ) !== n / base ) {

                return [ Math.ceil( sqrt ), Math.ceil( sqrt ) ];

            } else {

                return [ n /base, base ];         // [0]: width; [1]: height (shorter)

	        }
        }

    }

	return {

		getMaxSquareRoot: getMaxSquareRoot,

        getClosestTwoFactors: getClosestTwoFactors

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

let CenterLocator = ( function() {

	function createLineCenters( filters, width ) {

		let centerList = [];

		let fmLength = width;
		let initXTranslate;

		initXTranslate = - ( 1 + FeatureMapIntervalRatio ) * ( filters - 1 ) / 2 * fmLength;

		for ( let i = 0; i < filters; i++ ) {

			let xTranslate = initXTranslate + ( 1 + FeatureMapIntervalRatio ) * fmLength * i;
			let centerPos = [];
			centerPos.push( xTranslate );
			centerPos.push( 0 );

			centerList.push( centerPos );

		}

		return centerList;

	}

    function createRectangleCenters( filters, width, height ) {

        let centerList = [];

        // Get the best rectangle shape ([0]: width; [1]: height)
        let rectShape = MathUtils.getClosestTwoFactors( filters );

        let initXTranslate = - ( rectShape[0] - 1 ) / 2 * ( 1 + FeatureMapIntervalRatio ) * width;
        let initZTranslate = - ( rectShape[1] - 1 ) / 2 * ( 1 + FeatureMapIntervalRatio ) * height;

        for ( let i = 0; i < rectShape[ 0 ]; i ++ ) {

            for ( let j = 0; j < rectShape[ 1 ]; j ++ ) {

                let centerPos = [];

                let xTranslate = initXTranslate + ( 1 + FeatureMapIntervalRatio ) * width * i;    // width ==> i
                let zTranslate = initZTranslate + ( 1 + FeatureMapIntervalRatio ) * height * j;   // height==> j

                centerPos.push( xTranslate );
                centerPos.push( zTranslate );

                centerList.push( centerPos );

            }

        }

        return centerList;

    }

	return {

		createLineCenters: createLineCenters,

        createRectangleCenters: createRectangleCenters

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

let FmCenterGenerator = ( function() {

	let defaultYPos = 0;

	function getFmCenters( shape, filters, width, height ) {

		if ( shape === "line" ) {

			let centerList = CenterLocator.createLineCenters( filters, width );
			let fmCenters = create3DCenters( centerList );

			return fmCenters;

		} else if ( shape === "rect" ) {

			let centerList = CenterLocator.createRectangleCenters( filters, width, height );
            let fmCenters = create3DCenters( centerList );

            return fmCenters;

		} else {

			console.error( "do not support shape " + shape );

		}

	}

	function create3DCenters( centerList ) {

		let fmCenters = [];

		for ( let i = 0; i < centerList.length; i ++ ) {

			let center2d = centerList[ i ];
			let center3d = {};
			center3d.x = center2d[ 0 ];
			center3d.y = defaultYPos;
			center3d.z = center2d[ 1 ];
			fmCenters.push( center3d );

		}

		return fmCenters;

	}

	return {

		getFmCenters: getFmCenters

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let MapTransitionFactory = ( function() {

	function openLayer( layer ) {

		layer.disposeAggregationElement();
		layer.initSegregationElements( layer.closeFmCenters );

		let init = {

			ratio: 0

		};
		let end = {

			ratio: 1

		};

		let fmTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		fmTween.onUpdate( function() {

			for ( let i = 0; i < layer.segregationHandlers.length; i ++ ) {

				let tempPos = {

					x: init.ratio * ( layer.openFmCenters[ i ].x - layer.closeFmCenters[ i ].x ),
					y: init.ratio * ( layer.openFmCenters[ i ].y - layer.closeFmCenters[ i ].y ),
					z: init.ratio * ( layer.openFmCenters[ i ].z - layer.closeFmCenters[ i ].z )

				};

				layer.segregationHandlers[ i ].updatePos( tempPos );

			}

		} ).onStart( function() {

			layer.isWaitOpen = false;
			layer.isOpen = true;

		} ).onComplete( function() {

			layer.initCloseButton();

		} );

		fmTween.start();

		layer.isWaitOpen = true;

	}

	function closeLayer( layer ) {

		let init = {

			ratio: 1

		};
		let end = {

			ratio: 0

		};

		let fmTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		fmTween.onUpdate( function() {

			for ( let i = 0; i < layer.segregationHandlers.length; i ++ ) {

				let tempPos = {

					x: init.ratio * ( layer.openFmCenters[ i ].x - layer.closeFmCenters[ i ].x ),
					y: init.ratio * ( layer.openFmCenters[ i ].y - layer.closeFmCenters[ i ].y ),
					z: init.ratio * ( layer.openFmCenters[ i ].z - layer.closeFmCenters[ i ].z )

				};

				layer.segregationHandlers[ i ].updatePos( tempPos );

			}

		} ).onStart( function() {

			layer.disposeCloseButton();

		} ).onComplete( function() {

			layer.disposeSegregationElements();
			layer.initAggregationElement();
			layer.isWaitClose = false;
			layer.isOpen = false;

		} );

		fmTween.start();

		layer.isWaitClose = true;

	}

	return {

		openLayer: openLayer,

		closeLayer: closeLayer

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

function FeatureMap( width, height, unitLength, initCenter, color, minOpacity ) {

	this.fmWidth = width;
	this.fmHeight = height;

	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.fmWidth;
	this.actualHeight = this.unitLength * this.fmHeight;

	this.color = color;

	this.neuralLength = width * height;

	this.minOpacity = minOpacity;
	this.sideOpacity = SideFaceRatio * this.minOpacity;

	this.fmCenter = {

		x: initCenter.x,
		y: initCenter.y,
		z: initCenter.z

	};

	this.dataArray = undefined;
	this.dataTexture = undefined;
	this.featureMap = undefined;
	this.featureGroup = undefined;

	this.font = TextFont;

	this.textSize = TextHelper.calcFmTextSize( this.actualWidth );

	this.widthText = undefined;
	this.heightText = undefined;

	this.init();

}

FeatureMap.prototype = {

	init: function() {

		let amount = this.fmWidth * this.fmHeight;
		let data = new Uint8Array( amount );
		this.dataArray = data;

		for ( let i = 0; i < amount; i++ ) {

			data[ i ] = 255 * this.minOpacity;

		}

		let dataTex = new THREE.DataTexture( data, this.fmWidth, this.fmHeight, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.actualHeight );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			transparent: true,
			opacity: this.sideOpacity

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial

		];

		let cube = new THREE.Mesh( boxGeometry, materials );
		cube.elementType = "featureMap";
		cube.hoverable = true;

		this.featureMap = cube;

		let featureGroup = new THREE.Object3D();
		featureGroup.position.set( this.fmCenter.x, this.fmCenter.y, this.fmCenter.z );
		featureGroup.add( cube );
		this.featureGroup = featureGroup;

	},

	getElement: function() {

		return this.featureGroup;

	},

	updateVis: function( colors ) {

		let renderColor = RenderPreprocessor.preProcessFmColor( colors, this.fmWidth, this.fmHeight );

		for ( let i = 0; i < renderColor.length; i++ ) {

			this.dataArray[ i ] = renderColor[ i ] * 255;

		}

		this.dataTexture.needsUpdate = true;

	},

	updatePos: function( pos ) {

		this.fmCenter.x = pos.x;
		this.fmCenter.y = pos.y;
		this.fmCenter.z = pos.z;
		this.featureGroup.position.set( pos.x, pos.y, pos.z );

	},

	clear: function() {

		let zeroValue = new Int8Array( this.neuralLength );

		let colors = ColorUtils.getAdjustValues( zeroValue, this.minOpacity );

		this.updateVis( colors );

	},

	setLayerIndex: function( layerIndex ) {

		this.featureMap.layerIndex = layerIndex;

	},

	setFmIndex: function( fmIndex ) {

		this.featureMap.fmIndex = fmIndex;

	},

	showText: function() {

		let widthInString = this.fmWidth.toString();
		let heightInString = this.fmHeight.toString();

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let widthGeometry = new THREE.TextGeometry( widthInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let widthText = new THREE.Mesh( widthGeometry, material );

		let widthTextPos = TextHelper.calcFmWidthTextPos(

			widthInString.length,
			this.textSize,
			this.actualHeight,
			{

				x: this.featureMap.position.x,
				y: this.featureMap.position.y,
				z: this.featureMap.position.z

			}

		);

		widthText.position.set(

			widthTextPos.x,
			widthTextPos.y,
			widthTextPos.z

		);

		widthText.rotateX( - Math.PI / 2 );

		let heightGeometry = new THREE.TextGeometry( heightInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let heightText = new THREE.Mesh( heightGeometry, material );

		let heightTextPos = TextHelper.calcFmHeightTextPos(

			heightInString.length,
			this.textSize,
			this.actualWidth,
			{

				x: this.featureMap.position.x,
				y: this.featureMap.position.y,
				z: this.featureMap.position.z

			}

		);

		heightText.position.set(

			heightTextPos.x,
			heightTextPos.y,
			heightTextPos.z

		);

		heightText.rotateX( - Math.PI / 2 );

		this.widthText = widthText;
		this.heightText = heightText;

		this.featureGroup.add( this.widthText );
		this.featureGroup.add( this.heightText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.featureGroup.remove( this.widthText );
		this.featureGroup.remove( this.heightText );
		this.widthText = undefined;
		this.heightText = undefined;

		this.isTextShown = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function MapAggregation( width, height, unitLength, depth, color, minOpacity ) {

	this.width = width;
	this.height = height;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.width;
	this.actualHeight = this.unitLength * this.height;
	this.depth = depth;
	this.color = color;
	this.minOpacity = minOpacity;

	this.cube = undefined;
	this.aggregationElement = undefined;

	this.dataArray = undefined;
	this.dataTexture = undefined;

	this.init();

}

MapAggregation.prototype = {

	init: function() {

		let amount = this.width * this.height;
		let data = new Uint8Array( amount );
		this.dataArray = data;
		let dataTex = new THREE.DataTexture( data, this.width, this.height, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let geometry = new THREE.BoxBufferGeometry( this.actualWidth, this.depth, this.actualHeight );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial

		];

		let cube = new THREE.Mesh( geometry, materials );

		cube.position.set( 0, 0, 0 );
		cube.elementType = "aggregationElement";
		cube.clickable = true;
		cube.hoverable = true;

		this.cube = cube;

		let edgesGeometry = new THREE.EdgesGeometry( geometry );
		let edgesLine = new THREE.LineSegments(

			edgesGeometry,
			new THREE.LineBasicMaterial( { color: FrameColor } )

		);

		let aggregationGroup = new THREE.Object3D();
		aggregationGroup.add( cube );
		aggregationGroup.add( edgesLine );

		this.aggregationElement = aggregationGroup;

		this.clear();

	},

	getElement: function() {

		return this.aggregationElement;

	},

	setLayerIndex: function( layerIndex ) {

		this.cube.layerIndex = layerIndex;

	},

	clear: function() {

		let zeroValue = new Int8Array( this.width * this.height );
		let colors = ColorUtils.getAdjustValues( zeroValue, this.minOpacity );

		this.updateVis( colors );

	},

	updateVis: function( colors ) {

		let renderColor = RenderPreprocessor.preProcessFmColor( colors, this.width, this.height );

		for ( let i = 0; i < renderColor.length; i++ ) {

			this.dataArray[ i ] = renderColor[ i ] * 255;

		}

		this.dataTexture.needsUpdate = true;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 * @author zchholmes / https://github.com/zchholmes
 */

/**
 * NativeLayer3d, abstract layer, should not be initialized directly.
 * Output shape of NativeLayer3d is 3 dimensional: [width, height, depth]
 * Base class for:
 *      Conv2d, GlobalPooling2d, Pooling2d,
 *      Reshape2d, UpSampling2d, Cropping2d,
 *      Activation3d, BasicLayer3d.
 *
 * @param config, user's configuration for NativeLayer3d
 * @constructor
 */

function NativeLayer3d( config ) {

	// NativeLayer3d inherits from abstract layer "NativeLayer"

	NativeLayer.call( this, config );

	/**
	 * NativeLayer3d has three output dimensions: [ width, height, depth ]
	 *
	 * @type { int }
	 */

	this.width = undefined;
	this.height = undefined;
	this.depth = undefined;

	/**
     * Handler list of feature map.
	 *
	 * @type { Array }
	 */

	this.segregationHandlers = [];

	/**
     * Feature map centers while this.isOpen === true.
	 *
	 * @type { Array }
	 */

	this.openFmCenters = [];

	/**
     * Feature map centers while this.isOpen === false.
	 *
	 * @type { Array }
	 */

	this.closeFmCenters = [];

	/**
	 * Feature map shapes while expanded
	 * "line" or "rect", default to "rect".
	 * Check "ModelConfiguration.js" for more details.
	 *
	 * @type { string }
	 */

	this.layerShape = undefined;

	/**
	 * Aggregation mode.
	 * "max" or "average", default to "average".
     * Check "ModelConfiguration.js" for more details.
	 *
	 * @type { string }
	 */

	this.aggregationStrategy = undefined;

	/**
	 * Label to define whether layer need an "output value" from ML model (tfjs, keras, or tf).
	 * False means that user need to add value for NativeLayer3d when they are preprocessing multi-output for the model.
     *
     * Config on whether to calculate the output shape automatically or not.
     * "false" means user has to provide outputShape while preprocessing ML model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	this.layerDimension = 3;

}

NativeLayer3d.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override abstract functions of base class NativeLayer.
	 *
	 * NativeLayer3d overrides (from NativeLayer):
	 * init, updateValue, clear, handleClick, handleHoverIn, handleHoverOut
	 * calcCloseButtonSize, calcCloseButtonPos, provideRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() creates actual THREE.Object in NativeLayer3d, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to NativeLayer3d when call init() to initialize NativeLayer3d.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function(center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Objects in NativeLayer3d.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		// depth === 1 means that there is only one feature map in NativeLayer3d, no need for aggregation, open layer, or close layer.

		if ( this.depth === 1 ) {

			// Open layer and init one feature map (depth === 1) without initializing close button.

			this.isOpen = true;
			this.initSegregationElements( this.openFmCenters );

		} else {

			if ( this.isOpen ) {

                // Init feature maps with expanded positions.

				this.initSegregationElements( this.openFmCenters );

				// Init close button.

				this.initCloseButton();

			} else {

				// Init aggregation.

				this.initAggregationElement();

			}

		}

		// Add wrapper object to THREE.js scene.

		this.scene.add( this.neuralGroup );

		// Create relative line element.

		this.addLineGroup();

	},

	/**
	 * updateValue() accepts layer output value from model, updates layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

        // Provide external accessibility of layer output

		this.neuralValue = value;

		if ( this.isOpen ) {

			// If open, refresh and render feature maps.

			this.updateSegregationVis();

		} else {

			// If close, refresh and render aggregation.

			this.updateAggregationVis();

		}

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

            // Clean up feature maps by handlers.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

					this.segregationHandlers[ i ].clear();

				}

			} else {

				this.aggregationHandler.clear();

			}

			// Clean up layer data.

			this.neuralValue = undefined;

		}

	},

	/**
     * handleClick() be executed while clickable element is clicked.
	 *
	 * @param { THREE.Object } clickedElement, clicked element from Raycaster.
	 */

	handleClick: function( clickedElement ) {

		if ( clickedElement.elementType === "aggregationElement" ) {

			// If clicked aggregation element, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If clicked close button, close layer.

			this.closeLayer();

		}

	},

	/**
     * handleHoverIn() be executed while any hoverable element is detected by Raycaster.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element from Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// To enable relationSystem to show relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.showLines( hoveredElement );

		}

        // To enable textSystem to show hint text. For example, to show feature map size.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}

	},

	/**
     * handleHoverOut() called when mouse hover out.
	 */

	handleHoverOut: function() {

		// To enable relationSystem to hide relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.hideLines();

		}

		// To enable textSystem to hide hint text. For example, to hide feature map size.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * calcCloseButtonSize() calculate close button size.
     * Called by "initCloseButton" from "Layer"
	 *
	 * @return { number } size, calculated close button size
	 */

	calcCloseButtonSize: function() {

		// Total height when layer is open.

		let openHeight = this.actualHeight + this.openFmCenters[ this.openFmCenters.length - 1 ].z - this.openFmCenters[ 0 ].z;

		return  openHeight * CloseButtonRatio;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() calculate close button position.
     * Called by "initCloseButton" from "Layer"
	 *
	 * @return { JSON } position, calculated close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		let leftMostCenter = this.openFmCenters[ 0 ];
		let buttonSize = this.calcCloseButtonSize();

		return {

			x: leftMostCenter.x - this.actualWidth / 2 - 2 * buttonSize,
			y: 0,
			z: 0

		};

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
     * Bridge design patten:
     * 1. "getRelativeElements" request for relative elements from previous layer;
     * 2. "provideRelativeElements" of previous layer response to request, returns relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		if ( request.all !== undefined && request.all ) {

			// When "all" attribute in request is true, return all elements displayed in this layer.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

					relativeElements.push( this.segregationHandlers[ i ].getElement() );

				}

			} else {

				relativeElements.push( this.aggregationHandler.getElement() );

			}

		} else {

			if ( request.index !== undefined ) {

                // If index attribute is set in request.

				if ( this.isOpen ) {

					// If layer is open, return feature map element with the same index.

					relativeElements.push( this.segregationHandlers[ request.index ].getElement() );

				} else {

					// If layer is closed, return aggregation element.

					relativeElements.push( this.aggregationHandler.getElement() );

				}

			}

		}

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			let maxX = this.openFmCenters[ 0 ].x;

			for ( let i = 0; i < this.openFmCenters.length; i ++ ) {

				maxX = this.openFmCenters[ i ].x > maxX ? this.openFmCenters[ i ].x : maxX;

			}

			return maxX - this.calcCloseButtonPos().x + this.calcCloseButtonSize() + this.actualWidth;

		} else {

			return this.actualWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override abstract functions of base class "NativeLayer".
	 *
	 * ============
	 */

	/**
	 * openLayer() open NativeLayer3d, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			// MapTransitionFactory handles actual open animation, checkout "MapTransitionTween.js" for more information.

			MapTransitionFactory.openLayer( this );

		}

	},

	/**
	 * closeLayer() to collapse feature maps of NativeLayer3d. Switch layer status from "open" to "close".
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			// MapTransitionFactory handles close animation, checkout "MapTransitionTween.js" for more details.

			MapTransitionFactory.closeLayer( this );

		}

	},

	/**
	 * initSegregationElements() create feature maps's THREE.js Object, configure them, and add them to neuralGroup in NativeLayer3d.
	 *
	 * @param { JSON[] } centers, list of feature map's center (x, y, z), relative to layer
	 */

	initSegregationElements: function( centers ) {

		for ( let i = 0; i < this.depth; i ++ ) {

			// FeatureMap Object is a wrapper for one feature map, checkout "FeatureMap.js" for more information.

			let segregationHandler = new FeatureMap(

				this.width,
				this.height,
				this.unitLength,
				centers[ i ],
				this.color,
				this.minOpacity

			);

			// Set layer index to feature map, feature map object can know which layer it has been positioned.

			segregationHandler.setLayerIndex( this.layerIndex );

			// Set feature map index.

			segregationHandler.setFmIndex( i );

			// Store handler for feature map for latter use.

			this.segregationHandlers.push( segregationHandler );

			// Get actual THREE.js element and add it to layer wrapper Object.

			this.neuralGroup.add( segregationHandler.getElement() );

		}

		// Update all feature maps' visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateSegregationVis();

		}

	},

	/**
	 * disposeSegregationElements() remove feature maps from neuralGroup, clear their handlers, and dispose their THREE.js Object in NativeLayer3d.
	 */

	disposeSegregationElements: function () {

		for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

			// Remove feature maps' THREE.js object from neuralGroup.

			let segregationHandler = this.segregationHandlers[ i ];
			this.neuralGroup.remove( segregationHandler.getElement() );

		}

		// Clear handlers, actual objects will automatically be GC.

		this.segregationHandlers = [];

	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in NativeLayer3d.
	 */

	initAggregationElement: function() {

		// MapAggregation Object is a wrapper for feature maps' aggregation, checkout "MapAggregation.js" for more information.

		let aggregationHandler = new MapAggregation(

			this.width,
			this.height,
			this.unitLength,
			this.actualDepth,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, aggregation object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( aggregationHandler.getElement() );

		// Update aggregation's visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateAggregationVis();

		}

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in NativeLayer3d.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * updateAggregationVis() update feature maps' aggregation's visualization.
	 */

	updateAggregationVis: function() {

		// Generate aggregation data from layer's raw output data. Checkout "ChannelDataGenerator.js" for more information.

		let aggregationUpdateValue = ChannelDataGenerator.generateAggregationData(

			this.neuralValue,
			this.depth,
			this.aggregationStrategy

		);

		// Get colors to render the surface of aggregation.

		let colors = ColorUtils.getAdjustValues( aggregationUpdateValue, this.minOpacity );

		// aggregationHandler execute update visualization process.

		this.aggregationHandler.updateVis( colors );

	},

	/**
	 * updateSegregationVis() update feature maps' visualization.
	 */

	updateSegregationVis: function() {

		// Generate feature map data from layer's raw output data. Checkout "ChannelDataGenerator.js" for more information.

		let layerOutputValues = ChannelDataGenerator.generateChannelData( this.neuralValue, this.depth );

		let featureMapSize = this.width * this.height;

		// Each feature map handler execute its own update function.

		for ( let i = 0; i < this.depth; i ++ ) {

			// Get colors to render the surface of feature maps.

			let colors = ColorUtils.getAdjustValues(

				layerOutputValues.slice( i * featureMapSize, ( i + 1 ) * featureMapSize ),
				this.minOpacity

			);

			this.segregationHandlers[ i ].updateVis( colors );

		}

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		if ( element.elementType === "featureMap" ) {

			let fmIndex = element.fmIndex;
			this.segregationHandlers[ fmIndex ].showText();
			this.textElementHandler = this.segregationHandlers[ fmIndex ];

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for NativeLayer1d.
	 * SubClasses ( specific layers ) override these abstract method to get NativeLayer3d's characters.
	 *
	 * ============
	 */

	/**
	 * loadModelConfig() abstract method
	 * Load model's configuration into layer object.
	 *
	 * Override this function if there are some specific model configurations for layer.
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

	},

	/**
	 * assemble() abstract method
	 * Configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * Override this function to get information from previous layer
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

	},

	/**
	 * getRelativeElements() abstract method
	 * Get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Override this function to define relative element from previous layer
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		return [];

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 2D Convolution.
 *
 * @param config, user's configuration for Conv2d layer
 * @constructor
 */

function Conv2d( config ) {

	// "Conv2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * The dimension of the convolution window.
	 * The 2d convolutional window is square.
	 *
	 * @type { int }
	 */

	this.kernelSize = undefined;

	/**
	 * The depth of the layer output.
	 *
	 * @type { int }
	 */

	this.filters = undefined;

	/**
	 * The strides of the convolution.
	 * Strides in both dimensions are equal.
	 *
	 * @type { int }
	 */

	this.strides = undefined;

	/**
	 * Padding mode.
	 * "valid" or "same", default to "valid".
	 *
	 * @type { string }
	 */

	this.padding = "valid";

	/**
	 * Whether user directly define the layer shape.
	 * Set "true" if Conv2d's shape is predefined by user.
	 *
	 * @type { boolean }
	 */

	this.isShapePredefined = false;

	// Load user's Conv2d configuration.

	this.loadLayerConfig( config );

	// Init close feature map centers.

	for ( let i = 0; i < this.depth; i ++ ) {

		let center = {

			x: 0,
			y: 0,
			z: 0

		};

		this.closeFmCenters.push( center );

	}

	this.layerType = "Conv2d";

}

Conv2d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * Conv2d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function ( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// If user's do not define a specific 2d shape for feature map, infer layer output shape from input shape and config.

		if ( !this.isShapePredefined ) {

			// Two padding mode is the same as TensorFlow

			if ( this.padding === "valid" ) {

				// ceil[ ( W - F + 1 ) / S ]

				this.width = Math.ceil( ( this.inputShape[ 0 ] - this.kernelSize + 1 ) / this.strides );
				this.height = Math.ceil( ( this.inputShape[ 1 ] - this.kernelSize + 1 ) / this.strides );

			} else if ( this.padding === "same" ) {

				// ceil( W / S )

				this.width = Math.ceil( this.inputShape[ 0 ] / this.strides );
				this.height = Math.ceil( this.inputShape[ 1 ] / this.strides );

			}

		}

		// Conv2d layer's outputShape has three dimension, that's why Conv2d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.filters ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for open status.

		this.openFmCenters = FmCenterGenerator.getFmCenters(

			this.layerShape,
			this.depth,
			this.actualWidth,
			this.actualHeight

		);

	},

	/**
	 * loadModelConfig() load model's configuration into Conv2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.conv2d;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "featureMap" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Conv2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Conv2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// Optional configuration.

			this.kernelSize = layerConfig.kernelSize;
			this.strides = layerConfig.strides;

			// "filters" configuration is required.

			if ( layerConfig.filters !== undefined ) {

				this.filters = layerConfig.filters;
				this.depth = layerConfig.filters;

			} else {

				console.error( "\"filters\" property is required for Conv2d layer." );

			}

			// Load user's predefined 2d shape.

			if ( layerConfig.shape !== undefined ) {

				this.isShapePredefined = true;
				this.fmShape = layerConfig.shape;
				this.width = this.fmShape[ 0 ];
				this.height = this.fmShape[ 1 ];

			}

			// Load padding mode, accept two mode: "valid" and "same", support both uppercase and lowercase.

			if ( layerConfig.padding !== undefined ) {

				if ( layerConfig.padding.toLowerCase() === "valid" ) {

					this.padding = "valid";

				} else if ( layerConfig.padding.toLowerCase() === "same" ) {

					this.padding = "same";

				} else {

					console.error( "\"padding\" property do not support for " + layerConfig.padding + ", use \"valid\" or \"same\" instead." );

				}

			}

		} else {

			// Some configuration is required for Conv2d layer.

			console.error( "Lack config for Conv2d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Transposed convolutional layer (sometimes called Deconvolution).
 *
 * @param config, user's configuration for Conv2dTranspose layer
 * @constructor
 */

function Conv2dTranspose( config ) {

	// "Conv2dTranspose" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * The dimension of the convolution window.
	 * The 2d convolutional window is square.
	 *
	 * @type { int }
	 */

	this.kernelSize = undefined;

	/**
	 * The depth of the layer output.
	 *
	 * @type { int }
	 */

	this.filters = undefined;

	/**
	 * The strides of the convolution.
	 * Strides in both dimensions are equal.
	 *
	 * @type { int }
	 */

	this.strides = undefined;

	/**
	 * 2d feature map shape, stored as array.
	 * For example, [20, 20]
	 *
	 * @type { Array }
	 */

	this.fmShape = undefined;

	/**
	 * Padding mode.
	 * "valid" or "same", default to "valid".
	 *
	 * @type { string }
	 */

	this.padding = "valid";

	// Load user's Conv2dTranspose configuration.

	this.loadLayerConfig( config );

	// Init feature maps close feature centers.

	for ( let i = 0; i < this.depth; i ++ ) {

		let center = {

			x: 0,
			y: 0,
			z: 0

		};

		this.closeFmCenters.push( center );

	}

	this.layerType = "Conv2dTranspose";

}

Conv2dTranspose.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * Conv2dTranspose overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// infer layer output shape from input shape and config.

		if ( this.padding === "same" ) {

			// W * S

			this.width = this.inputShape[ 0 ] * this.strides[ 0 ];
			this.height = this.inputShape[ 1 ] * this.strides[ 1 ];

		} else if ( this.padding === "valid" ) {

			// ( W - 1 ) * S + F

			this.width = ( this.inputShape[ 0 ] - 1 ) * this.strides + this.kernelSize;
			this.height = ( this.inputShape[ 1 ] - 1 ) * this.strides + this.kernelSize;

		}

		// Conv2dTranspose layer's outputShape has three dimension, that's why Conv2dTranspose layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.filters ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for open status.

		this.openFmCenters = FmCenterGenerator.getFmCenters(

			this.layerShape,
			this.depth,
			this.actualWidth,
			this.actualHeight

		);

	},

	/**
	 * loadModelConfig() load model's configuration into Conv2dTranspose object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.conv2dTranspose;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "featureMap" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Conv2dTranspose.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Conv2dTranspose.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "filters" configuration is required.

			if ( layerConfig.filters !== undefined ) {

				this.filters = layerConfig.filters;
				this.depth = layerConfig.filters;

			} else {

				console.error( "\"filters\" property is required for Conv2dTranspose layer." );

			}

			// Optional configuration.

			if ( layerConfig.kernelSize !== undefined ) {

				this.kernelSize = layerConfig.kernelSize;

			}

			if ( layerConfig.strides !== undefined ) {

				this.strides = layerConfig.strides;

			}

			// Load padding mode, accept two mode: "valid" and "same", support both uppercase and lowercase.

			if ( layerConfig.padding !== undefined ) {

				if ( layerConfig.padding.toLowerCase() === "same" ) {

					this.padding = "same";

				} else if ( layerConfig.padding.toLowerCase() === "valid" ) {

					this.padding = "valid";

				} else {

					console.error( "\"padding\" property do not support for " + layerConfig.padding + ", use \"valid\" or \"same\" instead." );

				}

			}

		} else {

			console.error( "Lack config for Conv2dTranspose layer." );

		}

	}

} );

/**
 * Depthwise 2D Convolution.
 *
 * @param config, user's configuration for DepthwiseConv2d layer
 * @constructor
 */

function DepthwiseConv2d( config ) {

	// "DepthwiseConv2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * The dimension of the convolution window.
	 * The 2d convolutional window is square.
	 *
	 * @type { int }
	 */

	this.kernelSize = undefined;

	/**
	 * The number of depthwise convolution output channels for each input channel.
	 * Default to 1.
	 *
	 * @type { int }
	 */

	this.depthMultiplier = 1;

	/**
	 * The strides of the convolution.
	 * Strides in both dimensions are equal.
	 *
	 * @type { int }
	 */

	this.strides = undefined;

	/**
	 * Padding mode.
	 * "valid" or "same", default to "valid".
	 *
	 * @type { string }
	 */

	this.padding = "valid";

	// Load user's DepthwiseConv2d configuration.

	this.loadLayerConfig( config );

	this.layerType = "DepthwiseConv2d";

}

DepthwiseConv2d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * DepthwiseConv2d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function ( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Two padding mode is the same as TensorFlow

		if ( this.padding === "valid" ) {

			// ceil[ ( W - F + 1 ) / S ]

			this.width = Math.ceil( ( this.inputShape[ 0 ] - this.kernelSize + 1 ) / this.strides );
			this.height = Math.ceil( ( this.inputShape[ 1 ] - this.kernelSize + 1 ) / this.strides );

		} else if ( this.padding === "same" ) {

			// ceil( W / S )

			this.width = Math.ceil( this.inputShape[ 0 ] / this.strides );
			this.height = Math.ceil( this.inputShape[ 1 ] / this.strides );

		}

		this.depth = this.inputShape[ 2 ] * this.depthMultiplier;

		// DepthwiseConv2d layer's outputShape has three dimension, that's why DepthwiseConv2d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for open status.

		this.openFmCenters = FmCenterGenerator.getFmCenters(

			this.layerShape,
			this.depth,
			this.actualWidth,
			this.actualHeight

		);

		// Init close feature map centers.

		for ( let i = 0; i < this.depth; i ++ ) {

			let center = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( center );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into DepthwiseConv2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.depthwiseConv2d;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "featureMap" ) {

			// Get element relative to fmIndex.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: Math.floor( fmIndex / this.depthMultiplier )

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into DepthwiseConv2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for DepthwiseConv2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// Optional configuration.

			this.kernelSize = layerConfig.kernelSize;
			this.strides = layerConfig.strides;

			if ( layerConfig.depthMultiplier !== undefined ) {

				this.depthMultiplier = layerConfig.depthMultiplier;

			}

			// Load padding mode, accept two mode: "valid" and "same", support both uppercase and lowercase.

			if ( layerConfig.padding !== undefined ) {

				if ( layerConfig.padding.toLowerCase() === "valid" ) {

					this.padding = "valid";

				} else if ( layerConfig.padding.toLowerCase() === "same" ) {

					this.padding = "same";

				} else {

					console.error( "\"padding\" property do not support for " + layerConfig.padding + ", use \"valid\" or \"same\" instead." );

				}

			}

		} else {

			// Some configuration is required for Conv2d layer.

			console.error( "Lack config for DepthwiseConv2d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Cropping layer for 1D input.
 * This layer can crop an input at the left and right side.
 *
 * @param config, user's configuration for Cropping1d layer
 * @constructor
 */

function Cropping1d( config ) {

	// "Cropping1d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	/**
	 * Dimension of the cropping along the width.
	 *
	 * @type { Array }
	 */

	this.cropping = undefined;

	/**
	 * Actual cropping size to width.
	 *
	 * @type { int }
	 */

	this.croppingWidth = undefined;

	// Load user's Cropping1d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Cropping1d";

}

Cropping1d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * Cropping1d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer and user's configuration.

		this.width = this.inputShape[ 0 ] - this.croppingWidth;
		this.depth = this.inputShape[ 1 ];

		// Cropping1d layer's outputShape has two dimension, that's why Cropping1d layer inherits from abstract layer "NativeLayer2d".

		this.outputShape = [ this.width, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate the grid line centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeCenterList.push( closeCenter );

			// Cropping1d's grid lines align to last layer.

			let openCenter = {

				x: this.lastLayer.openCenterList[ i ].x,
				y: this.lastLayer.openCenterList[ i ].y,
				z: this.lastLayer.openCenterList[ i ].z

			};

			this.openCenterList.push( openCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Cropping1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.cropping1d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "gridLine" ) {

			// Get element which has the same index.

			let gridIndex = selectedElement.gridIndex;

			let request = {

				index: gridIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Cropping1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Cropping1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "cropping" configuration is required.

			if ( layerConfig !== undefined ) {

				this.cropping = layerConfig.cropping;
				this.croppingWidth = layerConfig.cropping[ 0 ] + layerConfig.cropping[ 1 ];

			} else {

				console.error( "\"cropping\" property is required for cropping1d layer." );

			}

		} else {

			console.error( "Lack config for cropping1d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Cropping layer for 2D input.
 * This layer can crop an input at the top, bottom, left and right side.
 *
 * @param config, user's configuration for Cropping2d layer
 * @constructor
 */

function Cropping2d( config ) {

	// "Cropping2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * Dimension of the cropping along the width and the height.
	 *
	 * @type { Array }
	 */

	this.cropping = undefined;

	/**
	 * Actual cropping size to width and height.
	 *
	 * @type { int }
	 */

	this.croppingWidth = undefined;
	this.croppingHeight = undefined;

	// Load user's Cropping2d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Cropping2d";

}

Cropping2d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * Cropping2d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer and user's configuration.

		this.width = this.inputShape[ 0 ] - this.croppingWidth;
		this.height = this.inputShape[ 1 ] - this.croppingHeight;

		this.depth = this.inputShape[ 2 ];

		// Cropping2d layer's outputShape has three dimension, that's why Cropping2d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( closeCenter );

			// Cropping2d's feature map align to last layer.

			let openCenter = {

				x: this.lastLayer.openFmCenters[ i ].x,
				y: this.lastLayer.openFmCenters[ i ].y,
				z: this.lastLayer.openFmCenters[ i ].z

			};

			this.openFmCenters.push( openCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Cropping2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.cropping2d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "featureMap" ) {

			// Get element which has the same index.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Cropping2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Cropping2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "cropping" configuration is required.

			if ( layerConfig.cropping !== undefined ) {

				this.cropping = layerConfig.cropping;
				this.croppingWidth = layerConfig.cropping[ 0 ][ 0 ] + layerConfig.cropping[ 0 ][ 1 ];
				this.croppingHeight = layerConfig.cropping[ 1 ][ 0 ] + layerConfig.cropping[ 1 ][ 1 ];

			} else {

				console.error( "\"cropping\" property is required for cropping2d layer." );

			}

		} else {

			console.error( "Lack config for cropping2d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function NeuralQueue( length, unitLength, color, minOpacity, overview ) {

	this.queueLength = length;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.queueLength;
	this.color = color;
	this.minOpacity = minOpacity;
	this.overview = overview;

	this.sideOpacity = SideFaceRatio * this.minOpacity;

	this.dataArray = undefined;
	this.backDataArray = undefined;
	this.dataTexture = undefined;
	this.backDataTexture = undefined;
	this.queue = undefined;

	this.queueGroup = undefined;

	this.font = TextFont;
	this.textSize = TextHelper.calcQueueTextSize( this.unitLength );
	this.textRotation = this.overview ? - Math.PI / 2 : 0;

	this.lengthText = undefined;

	this.init();

}

NeuralQueue.prototype = {

	init: function() {

		let data = new Uint8Array( this.queueLength );
		this.dataArray = data;
		let backData = new Uint8Array( this.queueLength );
		this.backDataArray = backData;

		for ( let i = 0; i < this.queueLength; i++ ) {

			data[ i ] = 255 * this.minOpacity;

		}

		let dataTex = new THREE.DataTexture( data, this.queueLength, 1, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let backDataTex = new THREE.DataTexture( backData, this.queueLength, 1, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.backDataTexture = backDataTex;

		backDataTex.magFilter = THREE.NearestFilter;
		backDataTex.needsUpdate = true;

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.unitLength );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let backMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: backDataTex,
			transparent: true

		} );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			transparent: true,
			opacity: this.sideOpacity

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			material,
			backMaterial

		];

		let cube = new THREE.Mesh( boxGeometry, materials );

		cube.position.set( 0, 0, 0 );
		cube.elementType = "featureLine";
		cube.hoverable = true;

		this.queue = cube;

		let queueGroup = new THREE.Object3D();
		queueGroup.add( this.queue );
		this.queueGroup = queueGroup;

	},

	getElement: function() {

		return this.queueGroup;

	},

	updateVis: function( colors ) {

		let backColors = RenderPreprocessor.preProcessQueueBackColor( colors );

		for ( let i = 0; i < colors.length; i++ ) {

			this.dataArray[ i ] = 255 * colors[ i ];
			this.backDataArray[ i ] = 255 * backColors[ i ];

		}

		this.dataTexture.needsUpdate = true;
		this.backDataTexture.needsUpdate = true;

	},

	clear: function() {

		let zeroData = new Uint8Array( this.queueLength );
		let colors = ColorUtils.getAdjustValues( zeroData, this.minOpacity );

		this.updateVis( colors );

	},

	setLayerIndex: function( layerIndex ) {

		this.queue.layerIndex = layerIndex;

	},

	showText: function() {

		let lengthTextContent = this.queueLength.toString();

		let geometry = new THREE.TextGeometry( lengthTextContent, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let text = new THREE.Mesh( geometry, material );

		text.rotateX( this.textRotation );

		let textPos = TextHelper.calcQueueTextPos(

			lengthTextContent.length,
			this.textSize,
			this.unitLength,
			{

				x: this.queue.position.x,
				y: this.queue.position.y,
				z: this.queue.position.z

			}

		);

		text.position.set(

			textPos.x,
			textPos.y,
			textPos.z

		);

		this.lengthText = text;

		this.queueGroup.add( this.lengthText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.queueGroup.remove( this.lengthText );
		this.lengthText = undefined;
		this.isTextShown = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Input1d, input layer, can be initialized by TensorSpace user.
 * Layer for linear input.
 *
 * @param config, user's configuration for Input1d.
 * @constructor
 */

function Input1d( config ) {

	// Input1d inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * Input1d has one output dimensions: [ width ].
	 *
	 * @type { int }
	 */

	this.width = undefined;
	this.outputShape = undefined;

	/**
	 * This attribute not for output, for latter layer,
	 * for example, padding1d.
	 *
	 * @type { int }
	 */

	this.depth = 1;

	// Load user's Input1d configuration.

	this.loadLayerConfig( config );

	/**
	 * As Input1d is the first layer model, actualWidth is defined as a const.
	 *
	 * @type { double }
	 */

	this.actualWidth = ModelInitWidth;

	/**
	 * Calculate unitLength for latter layers.
	 *
	 * @type { double }
	 */

	this.unitLength = this.actualWidth / this.width;

	/**
	 * Set this attribute for latter layer,
	 * for example, padding1d.
	 *
	 * @type { Array }
	 */

	this.openCenterList = [ {

		x: 0,
		y: 0,
		z: 0

	} ];

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * False means that user need to add value for Input1d when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	this.layerDimension = 1;

	this.layerType = "Input1d";

}

Input1d.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * Input1d overrides NativeLayer's function:
	 * init, assemble, updateValue, clear, handleHoverIn, handleHoverOut, loadModelConfig, getRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in Input1d, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to Input1d when call init() to initialize Input1d.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in Input1d.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		// Init linear input element.

		this.initAggregationElement();

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

	},

	/**
	 * assemble() configure layer's index in model.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

	},

	/**
	 * updateValue() accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

		this.neuralValue = value;

		// Get colors to render the surface of aggregation.

		let colors = ColorUtils.getAdjustValues( value, this.minOpacity );

		// aggregationHandler execute update visualization process.

		this.aggregationHandler.updateVis( colors );

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

			// Use handlers to clear visualization.

			this.aggregationHandler.clear();

			// Clear layer data.

			this.neuralValue = undefined;

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If textSystem is enabled, show hint text, for example, show input length.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If textSystem is enabled, hide hint text, for example, hide input length.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Input1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.input1d;

		}

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		// Return aggregation element as relative element.

		relativeElements.push( this.aggregationHandler.getElement() );

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		return this.actualWidth;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Input1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for RGBInput.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// Load input shape from user's configuration.

			if ( layerConfig.shape !== undefined ) {

				this.width = layerConfig.shape[ 0 ];
				this.outputShape = [ this.width ];

			} else {

				console.error( "\"shape\" is required for input1d layer." );

			}

		} else {

			console.error( "Lack config for Input1d layer." );

		}

	},

	/**
	 * initAggregationElement() create layer linear input's THREE.js Object, configure it, and add it to neuralGroup in Input1d.
	 */

	initAggregationElement: function() {

		// NeuralQueue Object is a wrapper for linear input element, checkout "NeuralQueue.js" for more information.

		let aggregationHandler = new NeuralQueue(

			this.width,
			this.unitLength,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, linear input element can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( aggregationHandler.getElement() );

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		if ( element.elementType === "featureLine" ) {

			this.aggregationHandler.showText();
			this.textElementHandler = this.aggregationHandler;

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * GreyscaleInput, input layer, can be initialized by TensorSpace user.
 * Layer for gray scale image.
 *
 * @param config, user's configuration for GreyscaleInput.
 * @constructor
 */

function GreyscaleInput( config ) {

	// GreyscaleInput inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * GreyscaleInput has two output dimensions: [ width, height ].
	 *
 	 * @type { int }
	 */

	this.width = undefined;
	this.height = undefined;

	/**
	 * This attribute not for output, for latter layer,
	 * for example, padding2d.
	 *
	 * @type { int }
	 */
	this.depth = 1;

	// Load user's GreyscaleInput configuration.

	this.loadLayerConfig( config );

	/**
	 * As GreyscaleInput is the first layer model, actualWidth is defined as a const.
	 * Use actualWidth to calculate actualHeight.
	 *
	 * @type { double }
	 */

	this.actualWidth = ModelInitWidth;
	this.actualHeight = ModelInitWidth / this.width * this.height;

	/**
	 * Calculate unitLength for latter layers.
	 *
	 * @type { double }
	 */

	this.unitLength = this.actualWidth / this.width;

	/**
	 * Set this attribute for latter layer,
	 * for example, padding2d.
	 *
	 * @type { Array }
	 */

	this.openFmCenters = [ {

		x: 0,
		y: 0,
		z: 0

	} ];

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * False means that user need to add value for GreyscaleInput when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	this.layerDimension = 2;

	this.layerType = "GreyscaleInput";

}

GreyscaleInput.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * GreyscaleInput overrides NativeLayer's function:
	 * init, assemble, updateValue, clear, handleHoverIn, handleHoverOut, loadModelConfig, provideRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in GreyscaleInput, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to GreyscaleInput when call init() to initialize GreyscaleInput.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in GreyscaleInput.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		// Init grey scale map.

		this.initAggregationElement();

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

	},

	/**
	 * assemble() configure layer's index in model.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

	},

	/**
	 * updateValue() accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

		this.neuralValue = value;

		// Get colors to render the surface of aggregation.

		let colors = ColorUtils.getAdjustValues( value, this.minOpacity );

		// aggregationHandler execute update visualization process.

		this.aggregationHandler.updateVis( colors );

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

			// Use handlers to clear visualization.

			this.aggregationHandler.clear();

			// Clear layer data.

			this.neuralValue = undefined;

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If textSystem is enabled, show hint text, for example, show map size.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If textSystem is enabled, hide hint text, for example, hide map size.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * loadModelConfig() load model's configuration into GreyscaleInput object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.greyscaleInput;

		}

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		// Return aggregation element as relative element.

		relativeElements.push( this.aggregationHandler.getElement() );

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		return this.actualWidth;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into GreyscaleInput.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for RGBInput.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// Load input shape from user's configuration.

			if ( layerConfig.shape !== undefined ) {

				this.width = layerConfig.shape[ 0 ];
				this.height = layerConfig.shape[ 1 ];
				this.outputShape = layerConfig.shape;

			} else {

				console.error( "\"shape\" property is required for GreyscaleInput layer" );

			}

		} else {

			console.error( "Lack config for GreyscaleInput layer." );

		}

	},

	/**
	 * initAggregationElement() create layer grey map's THREE.js Object, configure it, and add it to neuralGroup in RGBInput.
	 */

	initAggregationElement: function() {

		// FeatureMap Object is a wrapper for grey map, checkout "FeatureMap.js" for more information.

		let aggregationHandler = new FeatureMap(

			this.width,
			this.height,
			this.unitLength,
			{

				x: 0,
				y: 0,
				z: 0

			},
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, grey map object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( aggregationHandler.getElement() );

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		if ( element.elementType === "featureMap" ) {

			this.aggregationHandler.showText();
			this.textElementHandler = this.aggregationHandler;

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function InputMap3d( width, height, unitLength, actualDepth, initCenter, color, minOpacity ) {

	this.width = width;
	this.height = height;
	this.depth = 3;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.width;
	this.actualHeight = this.unitLength * this.height;
	this.actualDepth = actualDepth;

	this.minOpacity = minOpacity;
	this.sideOpacity = SideFaceRatio * this.minOpacity;

	this.fmCenter = {

		x: initCenter.x,
		y: initCenter.y,
		z: initCenter.z

	};

	this.color = color;

	this.neuralLength = 3 * width * height;

	this.dataArray = undefined;
	this.dataTexture = undefined;

	this.colorMap = undefined;
	this.colorGroup = undefined;

	this.font = TextFont;
	this.textSize = TextHelper.calcFmTextSize( this.actualWidth );

	this.init();

}

InputMap3d.prototype = {

	init: function() {

		let amount = 3 * this.width * this.height;

		let data = new Uint8Array( amount );
		this.dataArray = data;

		for ( let i = 0; i < amount; i++ ) {

			data[ i ] = 255 * this.minOpacity;

		}

		let dataTex = new THREE.DataTexture( data, this.width, this.height, THREE.RGBFormat );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.actualDepth, this.actualHeight );

		let material = new THREE.MeshBasicMaterial( { map: dataTex } );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			transparent: true,
			opacity: this.sideOpacity

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial
		];

		let cube = new THREE.Mesh( boxGeometry, materials );

		cube.elementType = "RGBInputElement";
		cube.clickable = true;
		cube.hoverable = true;

		this.colorMap = cube;

		let colorGroup = new THREE.Object3D();
		colorGroup.position.set( this.fmCenter.x, this.fmCenter.y, this.fmCenter.z );
		colorGroup.add( this.colorMap );

		this.colorGroup = colorGroup;

	},

	getElement: function() {

		return this.colorGroup;

	},

	updateVis: function( colors ) {

		let renderData = RenderPreprocessor.preProcessRGBInputColor( colors, this.width, this.height );

		for ( let i = 0; i < this.dataArray.length; i++ ) {

			this.dataArray[ i ] = 255 * renderData[ i ];

		}

		this.dataTexture.needsUpdate = true;

	},

	clear: function() {

		for ( let i = 0; i < this.dataArray.length; i++ ) {

			this.dataArray[ i ] = 255 * this.minOpacity;

		}

		this.dataTexture.needsUpdate = true;

	},

	setLayerIndex: function( layerIndex ) {

		this.colorMap.layerIndex = layerIndex;

	},

	showText: function() {

		let widthInString = this.width.toString();
		let heightInString = this.height.toString();

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let widthGeometry = new THREE.TextGeometry( widthInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let widthText = new THREE.Mesh( widthGeometry, material );

		let widthTextPos = TextHelper.calcFmWidthTextPos(

			widthInString.length,
			this.textSize,
			this.actualWidth,
			{

				x: this.colorMap.position.x,
				y: this.colorMap.position.y,
				z: this.colorMap.position.z

			}

		);

		widthText.position.set(

			widthTextPos.x,
			widthTextPos.y,
			widthTextPos.z

		);

		widthText.rotateX( - Math.PI / 2 );

		let heightGeometry = new THREE.TextGeometry( heightInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let heightText = new THREE.Mesh( heightGeometry, material );

		let heightTextPos = TextHelper.calcFmHeightTextPos(

			heightInString.length,
			this.textSize,
			this.actualHeight,
			{

				x: this.colorMap.position.x,
				y: this.colorMap.position.y,
				z: this.colorMap.position.z

			}

		);

		heightText.position.set(

			heightTextPos.x,
			heightTextPos.y,
			heightTextPos.z

		);

		heightText.rotateX( - Math.PI / 2 );

		this.widthText = widthText;
		this.heightText = heightText;

		this.colorGroup.add( this.widthText );
		this.colorGroup.add( this.heightText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.colorGroup.remove( this.widthText );
		this.colorGroup.remove( this.heightText );
		this.widthText = undefined;
		this.heightText = undefined;

		this.isTextShown = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function ChannelMap( width, height, unitLength, actualDepth, center, color, type, minOpacity ) {

	this.width = width;
	this.height = height;
	this.unitLength = unitLength;
	this.actualDepth = actualDepth;
	this.minOpacity = minOpacity;
	this.sideOpacity = SideFaceRatio * minOpacity;

	this.actualWidth = this.unitLength * this.width;
	this.actualHeight = this.unitLength * this.height;

	this.center = {

		x: center.x,
		y: center.y,
		z: center.z

	};

	this.color = color;
	this.type = type;

	this.dataArray = undefined;
	this.dataTexture = undefined;
	this.channelMap = undefined;
	this.channelGroup = undefined;

	this.font = TextFont;
	this.textSize = TextHelper.calcFmTextSize( this.actualWidth );

	this.widthText = undefined;
	this.heightText = undefined;

	this.init();

}

ChannelMap.prototype = {

	init: function() {

		let amount = 3 * this.width * this.height;
		let data = new Uint8Array( amount );
		this.dataArray = data;

		for ( let i = 0; i < amount; i++ ) {

			switch ( this.type ) {

				case 'R':

					if ( i % 3 === 0 ) {

						data[ i ] = 255 * this.minOpacity;

					}

					break;

				case 'G':

					if ( i % 3 === 1 ) {

						data[ i ] = 255 * this.minOpacity;

					}

					break;

				case 'B':

					if ( i % 3 === 2 ) {

						data[ i ] = 255 * this.minOpacity;

					}

					break;

				default:

					console.log( "do not support such channel type." );

			}

		}

		let dataTex = new THREE.DataTexture( data, this.width, this.height, THREE.RGBFormat );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.actualHeight );

		let material = new THREE.MeshBasicMaterial( {

			map: dataTex

		} );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			transparent: true,
			opacity: this.sideOpacity

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial

		];

		let cube = new THREE.Mesh( boxGeometry, materials );

		cube.hoverable = true;
		cube.elementType = "channelMap";

		this.channelMap = cube;

		let channelGroup = new THREE.Object3D();
		channelGroup.position.set( this.center.x, this.center.y, this.center.z );

		this.channelGroup = channelGroup;
		this.channelGroup.add( this.channelMap );

	},

	updateVis: function( colors ) {

		let renderColor = RenderPreprocessor.preProcessChannelColor( colors, this.width, this.height );

		for ( let i = 0; i < renderColor.length; i++ ) {

			switch ( this.type ) {

				case 'R':

					this.dataArray[ 3 * i ] = renderColor[ i ] * 255;
					break;

				case 'G':

					this.dataArray[ 3 * i + 1 ] = renderColor[ i ] * 255;
					break;

				case 'B':

					this.dataArray[ 3 * i + 2 ] = renderColor[ i ] * 255;
					break;

				default:

					console.error( "do not support such channel type." );

			}

		}

		this.dataTexture.needsUpdate = true;

	},

	getElement: function() {

		return this.channelGroup;

	},

	clear: function() {

		for ( let i = 0; i < this.dataArray.length; i++ ) {

			switch ( this.type ) {

				case 'R':

					if ( i % 3 === 0 ) {

						this.dataArray[ i ] = 255 * this.minOpacity;

					}

					break;

				case 'G':

					if ( i % 3 === 1 ) {

						this.dataArray[ i ] = 255 *  this.minOpacity;

					}

					break;

				case 'B':

					if ( i % 3 === 2 ) {

						this.dataArray[ i ] = 255 *  this.minOpacity;

					}

					break;

				default:

					console.error( "do not support such channel type." );

			}

		}

		this.dataTexture.needsUpdate = true;

	},

	updatePos: function( pos ) {

		this.center.x = pos.x;
		this.center.y = pos.y;
		this.center.z = pos.z;
		this.channelGroup.position.set( pos.x, pos.y, pos.z );

	},

	setLayerIndex: function( layerIndex ) {

		this.channelMap.layerIndex = layerIndex;

	},

	setFmIndex: function( fmIndex ) {

		this.channelMap.fmIndex = fmIndex;

	},

	showText: function() {

		let widthInString = this.width.toString();
		let heightInString = this.height.toString();

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let widthGeometry = new THREE.TextGeometry( widthInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let widthText = new THREE.Mesh( widthGeometry, material );

		let widthTextPos = TextHelper.calcFmWidthTextPos(

			widthInString.length,
			this.textSize,
			this.actualWidth,
			{

				x: this.channelMap.position.x,
				y: this.channelMap.position.y,
				z: this.channelMap.position.z

			}

		);

		widthText.position.set(

			widthTextPos.x,
			widthTextPos.y,
			widthTextPos.z

		);

		widthText.rotateX( - Math.PI / 2 );

		let heightGeometry = new THREE.TextGeometry( heightInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let heightText = new THREE.Mesh( heightGeometry, material );

		let heightTextPos = TextHelper.calcFmHeightTextPos(

			heightInString.length,
			this.textSize,
			this.actualHeight,
			{

				x: this.channelMap.position.x,
				y: this.channelMap.position.y,
				z: this.channelMap.position.z

			}

		);

		heightText.position.set(

			heightTextPos.x,
			heightTextPos.y,
			heightTextPos.z

		);

		heightText.rotateX( - Math.PI / 2 );

		this.widthText = widthText;
		this.heightText = heightText;

		this.channelGroup.add( this.widthText );
		this.channelGroup.add( this.heightText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.channelGroup.remove( this.widthText );
		this.channelGroup.remove( this.heightText );
		this.widthText = undefined;
		this.heightText = undefined;

		this.isTextShown = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

let RGBTweenFactory = ( function() {

	function separate( layer ) {

		let separateInit = {

			ratio: 0

		};
		let separateEnd = {

			ratio: 1

		};

		let separateTween = new TWEEN.Tween( separateInit )
			.to( separateEnd, layer.separateTime );

		separateTween.onUpdate( function() {

			layer.fmCenters = [];

			let rChannel = layer.segregationHandlers[ 0 ];
			let rCloseFmCenter = layer.closeFmCenters[ 0 ];
			let separateTopPos = layer.separateTopPos;

			let rTempPos = {

				x: separateInit.ratio * ( separateTopPos.x - rCloseFmCenter.x ),
				y: separateInit.ratio * ( separateTopPos.y - rCloseFmCenter.y ),
				z: separateInit.ratio * ( separateTopPos.z - rCloseFmCenter.z )

			};

			rChannel.updatePos( rTempPos );
			layer.fmCenters.push( rTempPos) ;

			layer.fmCenters.push( {

				x: 0,
				y: 0,
				z: 0

			} );

			let bChannel = layer.segregationHandlers[ 2 ];
			let bCloseFmCenter = layer.closeFmCenters[ 2 ];
			let separateBottomPos = layer.separateBottomPos;

			let bTempPos = {

				x: separateInit.ratio * ( separateBottomPos.x - bCloseFmCenter.x ),
				y: separateInit.ratio * ( separateBottomPos.y - bCloseFmCenter.y ),
				z: separateInit.ratio * ( separateBottomPos.z - bCloseFmCenter.z )

			};

			bChannel.updatePos( bTempPos );
			layer.fmCenters.push( bTempPos );

		} ).onStart( function() {

			layer.disposeAggregationElement();
			layer.initSegregationElements();

			layer.isWaitOpen = false;
			layer.isOpen = true;

		} ).onComplete( function() {

		} );

		let journeyInit = {

			ratio: 0

		};

		let journeyEnd = {

			ratio: 1

		};

		let journeyTween = new TWEEN.Tween( journeyInit )
			.to( journeyEnd, layer.openTime );

		journeyTween.onUpdate( function() {

			layer.fmCenters = [];

			let rChannel = layer.segregationHandlers[ 0 ];
			let separateTopPos = layer.separateTopPos;
			let rOpenFmCenter = layer.openFmCenters[ 0 ];

			let rTempPos = {

				x: journeyInit.ratio * ( rOpenFmCenter.x - separateTopPos.x ) + separateTopPos.x,
				y: journeyInit.ratio * ( rOpenFmCenter.y - separateTopPos.y ) + separateTopPos.y,
				z: journeyInit.ratio * ( rOpenFmCenter.z - separateTopPos.z ) + separateTopPos.z

			};

			rChannel.updatePos( rTempPos );
			layer.fmCenters.push( rTempPos );

			layer.fmCenters.push( {

				x: 0,
				y: 0,
				z: 0

			} );

			let bChannel = layer.segregationHandlers[ 2 ];
			let separateBottomPos = layer.separateBottomPos;
			let bOpenFmCenter = layer.openFmCenters[ 2 ];

			let bTempPos = {

				x: journeyInit.ratio * ( bOpenFmCenter.x - separateBottomPos.x ) + separateBottomPos.x,
				y: journeyInit.ratio * ( bOpenFmCenter.y - separateBottomPos.y ) + separateBottomPos.y,
				z: journeyInit.ratio * ( bOpenFmCenter.z - separateBottomPos.z ) + separateBottomPos.z

			};

			bChannel.updatePos( bTempPos );
			layer.fmCenters.push( bTempPos );

		} ).onStart( function() {

		} ).onComplete( function() {

			layer.initCloseButton();

		} );

		separateTween.chain( journeyTween );
		separateTween.start();

		layer.isWaitOpen = true;

	}

	function aggregate( layer ) {

		let homingInit = {

			ratio: 1

		};

		let homingEnd = {

			ratio: 0

		};

		let homingTween = new TWEEN.Tween( homingInit )
			.to( homingEnd, layer.openTime );

		homingTween.onUpdate( function() {

			layer.fmCenters = [];

			let rChannel = layer.segregationHandlers[ 0 ];
			let separateTopPos = layer.separateTopPos;
			let rOpenFmCenter = layer.openFmCenters[ 0 ];

			let rTempPos = {

				x: homingInit.ratio * ( rOpenFmCenter.x - separateTopPos.x ) + separateTopPos.x,
				y: homingInit.ratio * ( rOpenFmCenter.y - separateTopPos.y ) + separateTopPos.y,
				z: homingInit.ratio * ( rOpenFmCenter.z - separateTopPos.z ) + separateTopPos.z

			};

			rChannel.updatePos( rTempPos );
			layer.fmCenters.push( rTempPos );

			layer.fmCenters.push( {

				x: 0,
				y: 0,
				z: 0

			} );

			let bChannel = layer.segregationHandlers[ 2 ];
			let separateBottomPos = layer.separateBottomPos;
			let bOpenFmCenter = layer.openFmCenters[ 2 ];

			let bTempPos = {

				x: homingInit.ratio * ( bOpenFmCenter.x - separateBottomPos.x ) + separateBottomPos.x,
				y: homingInit.ratio * ( bOpenFmCenter.y - separateBottomPos.y ) + separateBottomPos.y,
				z: homingInit.ratio * ( bOpenFmCenter.z - separateBottomPos.z ) + separateBottomPos.z

			};

			bChannel.updatePos( bTempPos );
			layer.fmCenters.push( bTempPos );

		} ).onStart(function() {

			layer.disposeCloseButton();

		} ).onComplete( function() {

		} );

		let aggregateInit = {

			ratio: 1

		};

		let aggregateEnd = {

			ratio: 0

		};

		let aggregateTween = new TWEEN.Tween( aggregateInit )
			.to( aggregateEnd, layer.separateTime );

		aggregateTween.onUpdate( function() {

			layer.fmCenters = [];

			let rChannel = layer.segregationHandlers[ 0 ];
			let rCloseFmCenter = layer.closeFmCenters[ 0 ];
			let separateTopPos = layer.separateTopPos;

			let rTempPos = {

				x: aggregateInit.ratio * ( separateTopPos.x - rCloseFmCenter.x ),
				y: aggregateInit.ratio * ( separateTopPos.y - rCloseFmCenter.y ),
				z: aggregateInit.ratio * ( separateTopPos.z - rCloseFmCenter.z )

			};

			rChannel.updatePos( rTempPos );
			layer.fmCenters.push( rTempPos );

			layer.fmCenters.push( {

				x: 0,
				y: 0,
				z: 0

			} );

			let bChannel = layer.segregationHandlers[ 2 ];
			let bCloseFmCenter = layer.closeFmCenters[ 2 ];
			let separateBottomPos = layer.separateBottomPos;

			let bTempPos = {

				x: aggregateInit.ratio * ( separateBottomPos.x - bCloseFmCenter.x ),
				y: aggregateInit.ratio * ( separateBottomPos.y - bCloseFmCenter.y ),
				z: aggregateInit.ratio * ( separateBottomPos.z - bCloseFmCenter.z )

			};

			bChannel.updatePos( bTempPos );
			layer.fmCenters.push( bTempPos );

		} ).onStart( function() {

		} ).onComplete(function() {

			layer.disposeSegregationElements();
			layer.initAggregationElement();

			layer.isWaitClose = false;
			layer.isOpen = false;

		} );

		homingTween.chain( aggregateTween );
		homingTween.start();

		layer.isWaitClose = true;

	}

	return {

		separate: separate,

		aggregate: aggregate

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * RGBInput, input layer, can be initialized by TensorSpace user.
 * Layer for RGB image.
 * RGB image has width and height, sometimes, we consider it a 2D input,
 * however, in TensorSpace when we separate RGB image into R, G, B channel,
 * we can find that the it actual has the third dimension depth = 3.
 *
 * @param config, user's configuration for RGBInput.
 * @constructor
 */

function RGBInput( config ) {

	// RGBInput inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * RGBInput has three output dimensions: [ width, height, depth ].
	 *
	 * @type { int }
	 */

	this.width = undefined;
	this.height = undefined;
	this.depth = 3;

	// Load user's RGBInput configuration.

	this.loadLayerConfig( config );

	/**
	 * As RGBInput is the first layer model, actualWidth is defined as a const.
	 * Use actualWidth to calculate actualHeight.
	 *
	 * @type { double }
	 */

	this.actualWidth = ModelInitWidth;
	this.actualHeight = this.actualWidth / this.width * this.height;

	/**
	 * Calculate unitLength for latter layers.
	 *
	 * @type { double }
	 */

	this.unitLength =  this.actualWidth / this.width;


	/**
	 * Channel maps's centers when layer is totally open.
	 *
	 * @type { Array }
	 */
	this.openFmCenters = FmCenterGenerator.getFmCenters( "line", 3, this.actualWidth, this.actualHeight );

	/**
	 * Channel maps' centers when layer is closed.
	 *
	 * @type { Array }
	 */

	this.closeFmCenters = [];

	for ( let i = 0; i < 3; i ++ ) {

		this.closeFmCenters.push( {

			x: 0,
			y: 0,
			z: 0

		} );

	}

	// Predefined position for channel map when separate from close position.

	this.separateTopPos = {

		x: 0,
		y: 20,
		z: 0

	};

	this.separateBottomPos = {

		x: 0,
		y: -20,
		z: 0

	};

	/**
	 * Channel map's handlers list.
	 *
	 * @type { Array }
	 */

	this.segregationHandlers = [];

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * False means that user need to add value for RGBInput when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	this.layerDimension = 3;

	this.layerType = "RGBInput";

}

RGBInput.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * RGBInput overrides NativeLayer's function:
	 * init, assemble, updateValue, clear, handleClick, handleHoverIn, handleHoverOut, loadModelConfig,
	 * calcCloseButtonSize, calcCloseButtonPos, provideRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in RGBInput, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to RGBInput when call init() to initialize RGBInput.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in RGBInput.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		// Init RGB map element.

		this.initAggregationElement();

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

	},

	/**
	 * assemble() configure layer's index in model.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

	},

	/**
	 * updateValue() accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

		// Store layer output value in "neuralValue" attribute, this attribute can be get by TensorSpace user.

		this.neuralValue = value;

		if ( this.isOpen ) {

			// If layer is open, update Channel maps' visualization.

			this.updateSegregationVis();

		} else {

			// If layer is close, update RGB map's visualization.

			this.updateAggregationVis();

		}

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

			// Use handlers to clear visualization.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

					this.segregationHandlers[ i ].clear();

				}

			} else {

				this.aggregationHandler.clear();

			}

			// Clear layer data.

			this.neuralValue = undefined;

		}

	},

	/**
	 * handleClick() If clickable element in this layer is clicked, execute this handle function.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

		if ( clickedElement.elementType === "RGBInputElement" ) {

			// If aggregation element is clicked, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If close button is clicked, close layer.

			this.closeLayer();

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If textSystem is enabled, show hint text, for example, show map size.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If textSystem is enabled, hide hint text, for example, hide map size.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * loadModelConfig() load model's configuration into RGBInput object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.RGBInput;

		}

	},

	/**
	 * calcCloseButtonSize() get close button size.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		return 3 * this.actualHeight * CloseButtonRatio;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() get close button position.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { JSON } position, close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		return {

			x: this.openFmCenters[ 0 ].x - this.actualWidth / 2 - 30,
			y: 0,
			z: 0

		};

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		if ( request.all !== undefined && request.all ) {

			// When "all" attribute in request is true, return all elements displayed in this layer.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

					relativeElements.push( this.segregationHandlers[ i ].getElement() );

				}

			} else {

				relativeElements.push( this.aggregationHandler.getElement() );

			}

		} else {

			if ( request.index !== undefined ) {

				if ( this.isOpen ) {

					// If index attribute is set in request, and layer is open, return Channel map element which has the same index.

					relativeElements.push( this.segregationHandlers[ request.index ].getElement() );

				} else {

					// If layer is closed, return aggregation element.

					relativeElements.push( this.aggregationHandler.getElement() );

				}

			}

		}

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			let maxX = this.openFmCenters[ 0 ].x;

			for ( let i = 0; i < this.openFmCenters.length; i ++ ) {

				maxX = this.openFmCenters[ i ].x > maxX ? this.openFmCenters[ i ].x : maxX;

			}

			return maxX - this.calcCloseButtonPos().x + this.calcCloseButtonSize() + this.actualWidth;

		} else {

			return this.actualWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * openLayer() open RGBInput, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			// RGBTweenFactory handles actual open animation, checkout "RGBChannelTween.js" for more information.

			RGBTweenFactory.separate( this );

		}

	},

	/**
	 * closeLayer() close Output1d, switch layer status from "open" to "close".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			// RGBTweenFactory handles actual close animation, checkout "RGBChannelTween.js" for more information.

			RGBTweenFactory.aggregate( this );

		}

	},

	/**
	 * loadLayerConfig() Load user's configuration into RGBInput.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for RGBInput.
	 */

	loadLayerConfig: function( layerConfig ) {

		// Load input shape from user's configuration.

		if ( layerConfig !== undefined ) {

			this.inputShape = layerConfig.shape;
			this.width = layerConfig.shape[ 0 ];
			this.height = layerConfig.shape[ 1 ];
			this.outputShape = [ this.width, this.height, this.depth ];

		} else {

			console.error( "\"shape\" property is require for RGBInput layer." );

		}

	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in RGBInput.
	 */

	initAggregationElement: function() {

		// InputMap3d Object is a wrapper for RGB map element, checkout "InputMap3d.js" for more information.

		let aggregationHandler = new InputMap3d(

			this.width,
			this.height,
			this.unitLength,
			this.actualDepth,
			{

				x: 0,
				y: 0,
				z: 0

			},
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, RGB map object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( this.aggregationHandler.getElement() );

		// Update RGB map's visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateAggregationVis();

		}

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in RGBInput.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * initSegregationElements() create Channel maps' THREE.js Object, configure them, and add them to neuralGroup in RGBInput.
	 */

	initSegregationElements: function() {

		// Init r, g, b channel elements.

		let rChannel = new ChannelMap(

			this.width,
			this.height,
			this.unitLength,
			this.actualDepth,
			this.closeFmCenters[ 0 ],
			this.color,
			"R",
			this.minOpacity

		);

		let gChannel = new ChannelMap(

			this.width,
			this.height,
			this.unitLength,
			this.actualDepth,
			this.closeFmCenters[ 1 ],
			this.color,
			"G",
			this.minOpacity

		);

		let bChannel = new ChannelMap(

			this.width,
			this.height,
			this.unitLength,
			this.actualDepth,
			this.closeFmCenters[ 2 ],
			this.color,
			"B",
			this.minOpacity

		);

		// Set layer index to channel handler, channel map object can know which layer it has been positioned.

		rChannel.setLayerIndex( this.layerIndex );

		// Set channelIndex index.

		rChannel.setFmIndex( 0 );
		gChannel.setLayerIndex( this.layerIndex );
		gChannel.setFmIndex( 1 );
		bChannel.setLayerIndex( this.layerIndex );
		bChannel.setFmIndex( 2 );

		// Store handler for feature map for latter use.

		this.segregationHandlers.push( rChannel );
		this.segregationHandlers.push( gChannel );
		this.segregationHandlers.push( bChannel );

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( rChannel.getElement() );
		this.neuralGroup.add( gChannel.getElement() );
		this.neuralGroup.add( bChannel.getElement() );

		// Update all channel maps' visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateSegregationVis();

		}

	},

	/**
	 * disposeSegregationElements() remove feature maps from neuralGroup, clear their handlers, and dispose their THREE.js Object in RGBInput.
	 */

	disposeSegregationElements: function() {

		for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

			// Remove channel maps' THREE.js object from neuralGroup.

			this.neuralGroup.remove( this.segregationHandlers[ i ].getElement() );

		}

		// Clear handlers, actual objects will automatically be GC.

		this.segregationHandlers = [];

	},

	/**
	 * updateAggregationVis() update RGB map's aggregation's visualization.
	 */

	updateAggregationVis: function() {

		// Get colors to render the surface of aggregation.

		let colors = ColorUtils.getAdjustValues( this.neuralValue, this.minOpacity );

		// aggregationHandler execute update visualization process.

		this.aggregationHandler.updateVis( colors );

	},

	/**
	 * updateSegregationVis() update channel maps' visualization.
	 */

	updateSegregationVis: function() {

		let colors = ColorUtils.getAdjustValues( this.neuralValue, this.minOpacity );

		let rVal = [];
		let gVal = [];
		let bVal = [];

		for ( let i = 0; i < colors.length; i ++ ) {

			if ( i % 3 === 0 ) {

				rVal.push( colors[ i ] );

			} else if ( i % 3 === 1 ) {

				gVal.push( colors[ i ] );

			} else {

				bVal.push( colors[ i ] );

			}

		}

		this.segregationHandlers[ 0 ].updateVis( rVal );
		this.segregationHandlers[ 1 ].updateVis( gVal );
		this.segregationHandlers[ 2 ].updateVis( bVal );

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		if ( element.elementType === "channelMap" ) {

			let fmIndex = element.fmIndex;

			this.segregationHandlers[ fmIndex ].showText();
			this.textElementHandler = this.segregationHandlers[ fmIndex ];

		} else if ( element.elementType === "RGBInputElement" ) {

			this.aggregationHandler.showText();
			this.textElementHandler = this.aggregationHandler;

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function QueueAggregation( actualWidth, actualHeight, actualDepth, color, minOpacity ) {

	this.actualWidth = actualWidth;
	this.actualHeight = actualHeight;
	this.actualDepth = actualDepth;
	this.color = color;
	this.minOpacity = minOpacity;

	this.cube = undefined;
	this.aggregationElement = undefined;

	this.init();

}

QueueAggregation.prototype = {

	init: function() {

		let geometry = new THREE.BoxBufferGeometry( this.actualWidth, this.actualDepth, this.actualHeight );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let cube = new THREE.Mesh( geometry, material );

		cube.position.set( 0, 0, 0 );
		cube.clickable = true;
		cube.hoverable = true;
		cube.elementType = "aggregationElement";

		this.cube = cube;

		let edgesGeometry = new THREE.EdgesGeometry( geometry );

		let edgesLine = new THREE.LineSegments(

			edgesGeometry,
			new THREE.LineBasicMaterial( { color: FrameColor } )

		);

		let aggregationGroup = new THREE.Object3D();
		aggregationGroup.add( cube );
		aggregationGroup.add( edgesLine );

		this.aggregationElement = aggregationGroup;

	},

	getElement: function() {

		return this.aggregationElement;

	},

	setLayerIndex: function( layerIndex ) {

		this.cube.layerIndex = layerIndex;

	},

	setPositionedLayer: function( layerType ) {

		this.cube.positionedLayer = layerType;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

let OutputTransitionFactory = ( function() {

	function openLayer( layer ) {

		let init = {

			ratio: 0

		};

		let end = {

			ratio: 1

		};

		let openTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		layer.disposeAggregationElement();
		layer.initOutputElement("close");

		openTween.onUpdate( function() {

			let poses = [];

			for ( let i = 0; i < layer.outputHandler.outputLength; i ++ ) {

				let pos = {

					x: init.ratio * ( layer.outputHandler.openResultPos[ i ].x - layer.outputHandler.closeResultPos[ i ].x ),
					y: init.ratio * ( layer.outputHandler.openResultPos[ i ].y - layer.outputHandler.closeResultPos[ i ].y ),
					z: init.ratio * ( layer.outputHandler.openResultPos[ i ].z - layer.outputHandler.closeResultPos[ i ].z )

				};

				poses.push( pos );

			}

			layer.outputHandler.updatePoses( poses );

		} ).onStart( function() {

			layer.isWaitOpen = false;
			layer.isOpen = true;

		} ).onComplete( function() {

			layer.initCloseButton();

			if ( layer.paging ) {

				layer.showPaginationButton();

			}

		} );

		openTween.start();

		layer.isWaitOpen = true;

	}

	function closeLayer( layer ) {

		let init = {

			ratio: 1

		};

		let end = {

			ratio: 0

		};

		let closeTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		layer.disposeCloseButton();

		closeTween.onUpdate( function() {

			let poses = [];

			for ( let i = 0; i < layer.outputHandler.outputLength; i ++ ) {

				let pos = {

					x: init.ratio * ( layer.outputHandler.openResultPos[ i ].x - layer.outputHandler.closeResultPos[ i ].x ),
					y: init.ratio * ( layer.outputHandler.openResultPos[ i ].y - layer.outputHandler.closeResultPos[ i ].y ),
					z: init.ratio * ( layer.outputHandler.openResultPos[ i ].z - layer.outputHandler.closeResultPos[ i ].z )

				};

				poses.push( pos );

			}

			layer.outputHandler.updatePoses( poses );

		} ).onStart( function() {

			if ( layer.paging ) {

				layer.hidePaginationButton();

			}

		} ).onComplete( function() {

			console.log( "end close output layer" );
			layer.disposeOutputElement();
			layer.initAggregationElement();

			layer.isWaitClose = false;
			layer.isOpen = false;

		} );

		closeTween.start();

		layer.isWaitClose = true;

	}

	return {

		openLayer: openLayer,

		closeLayer: closeLayer

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

let OutputExtractor = ( function() {

	function getMaxConfidenceIndex( values ) {

		let index = 0;
		let maxValue = 0;

		for ( let i = 0; i < values.length; i ++ ) {

			if ( values[ i ] >= maxValue ) {

				index = i;
				maxValue = values[ i ];

			}

		}

		return index;

	}

	return {

		getMaxConfidenceIndex: getMaxConfidenceIndex

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

function OutputUnit( unitLength, output, initPositions, color, minOpacity, overview ) {

	this.output = output;
	this.unitLength = unitLength;
	this.color = color;
	this.minOpacity = minOpacity;
	this.overview = overview;

	this.cubeSize = this.unitLength;
	this.textSize = TextHelper.calcOutputTextSize( this.unitLength );
	this.textRotation = this.overview ? - Math.PI / 2 : 0;

	this.initPosition = {

		x: initPositions.x,
		y: initPositions.y,
		z: initPositions.z

	};

	this.position = {

		x: initPositions.x,
		y: initPositions.y,
		z: initPositions.z

	};

	this.isTextShown = false;

	this.font = TextFont;

	this.outputText = undefined;
	this.outputNeural = undefined;
	this.outputGroup = undefined;

	this.init();

}

OutputUnit.prototype = {

	init: function() {

		let outputGroup = new THREE.Object3D();

		let boxGeometry = new THREE.BoxBufferGeometry( this.cubeSize, this.cubeSize, this.cubeSize );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let cube = new THREE.Mesh( boxGeometry, material );
		cube.elementType = "outputNeural";
		cube.hoverable = true;
		cube.clickable = true;

		this.outputNeural = cube;

		outputGroup.add( cube );
		this.outputGroup = outputGroup;

		this.outputGroup.position.set(

			this.initPosition.x,
			this.initPosition.y,
			this.initPosition.z

		);

	},

	getElement: function() {

		return this.outputGroup;

	},

	updateVis: function( color ) {

		this.outputNeural.material.opacity = color;
		this.outputNeural.material.needsUpdate = true;

	},

	showText: function() {

		let geometry = new THREE.TextGeometry( this.output, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength / 3, 1 ),
			curveSegments: 8

		} );

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let text = new THREE.Mesh( geometry, material );

		text.rotateX( this.textRotation );

		let textPos = TextHelper.calcOutputTextPos(

			this.output.length,
			this.textSize,
			this.cubeSize,
			{

				x: this.outputNeural.position.x,
				y: this.outputNeural.position.y,
				z: this.outputNeural.position.z

			}

		);

		text.position.set(

			textPos.x,
			textPos.y,
			textPos.z

		);

		this.outputText = text;

		this.outputGroup.add( text );
		this.isTextShown = true;

	},

	hideText: function() {

		this.outputGroup.remove( this.outputText );
		this.outputText = undefined;
		this.isTextShown = false;

	},

	clear: function() {

		let colors = ColorUtils.getAdjustValues( [ 0 ], this.minOpacity );

		this.updateVis( colors );

		if ( this.outputText !== undefined ) {

			this.hideText();

		}

	},

	setLayerIndex: function( layerIndex ) {

		this.outputNeural.layerIndex = layerIndex;

	},

	setOutputIndex: function( outputIndex ) {

		this.outputNeural.outputIndex = outputIndex;

	},

	isSelected: function() {

		return this.isTextShown;

	},

	updatePos: function( pos ) {

		this.position.x = pos.x;
		this.position.y = pos.y;
		this.position.z = pos.z;
		this.outputGroup.position.set( pos.x, pos.y, pos.z );

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

let OutputNeuralPosGenerator = ( function() {

	function getLinePos( units, unitLength ) {

		let posList = [];

		let initXTranslate = - unitLength * ( units - 1 ) / 2 * ( 1 + OutputNeuralInterval );

		for ( let i = 0; i < units; i++ ) {

			let pos = {

				x: initXTranslate + i * ( 1 + OutputNeuralInterval ) * unitLength,
				y: 0,
				z: 0

			};

			posList.push( pos );

		}

		return posList;

	}

	return {

		getLinePos: getLinePos

	}

} )();

function OutputQueue( units, outputs, unitLength, color, minOpacity, initStatus, overview ) {

	this.units = units;
	this.outputs = outputs;
	this.unitLength = unitLength;
	this.color = color;
	this.minOpacity = minOpacity;
	this.initStatus = initStatus;
	this.overview = overview;

	this.outputLength = units;

	this.closeResultPos = [];
	this.openResultPos = [];

	for ( let i = 0; i < units; i ++ ) {

		this.closeResultPos.push( {

			x: 0,
			y: 0,
			z: 0

		} );

	}

	this.openResultPos = OutputNeuralPosGenerator.getLinePos( this.units, this.unitLength );

	this.leftBoundary = this.openResultPos[0];
	this.rightBoundary = this.openResultPos[ this.units - 1 ];

	this.outputUnitList = [];

	this.outputGroup = undefined;

	this.textNeuralIndex = undefined;

	this.init();

}

OutputQueue.prototype = {

	init: function() {

		let unitsInitPos;

		if ( this.initStatus === "close" ) {

			unitsInitPos = this.closeResultPos;

		} else {

			unitsInitPos = this.openResultPos;

		}

		for ( let i = 0; i < this.units; i ++ ) {

			let unitHandler = new OutputUnit(

				this.unitLength,
				this.outputs[ i ],
				unitsInitPos[ i ],
				this.color,
				this.minOpacity,
				this.overview

			);

			unitHandler.setOutputIndex( i );

			this.outputUnitList.push( unitHandler );

		}

		let outputGroup = new THREE.Object3D();
		this.outputGroup = outputGroup;

		for ( let i = 0; i < this.outputUnitList.length; i ++ ) {

			this.outputGroup.add( this.outputUnitList[ i ].getElement() );

		}

	},

	updateVis: function( colors ) {

		for ( let i = 0; i < colors.length; i ++ ) {

			this.outputUnitList[ i ].updateVis( [ colors[ i ] ] );

		}

	},

	setLayerIndex: function( layerIndex ) {

		for ( let i = 0; i < this.outputUnitList.length; i ++ ) {

			this.outputUnitList[ i ].setLayerIndex( layerIndex );

		}

	},

	getElement: function() {

		return this.outputGroup;

	},

	showText( selectedNeural ) {

		this.hideText();

		let selectedIndex = selectedNeural.outputIndex;

		this.outputUnitList[ selectedIndex ].showText();
		this.textNeuralIndex = selectedIndex;

	},

	showTextWithIndex: function( index ) {

		this.hideText();

		this.outputUnitList[ index ].showText();
		this.textNeuralIndex = index;

	},

	hideText: function() {

		if ( this.textNeuralIndex !== undefined ) {

			this.outputUnitList[ this.textNeuralIndex ].hideText();
			this.textNeuralIndex = undefined;

		}

	},

	clear: function() {

		let zeroValue = new Int8Array( this.units );

		let colors = ColorUtils.getAdjustValues( zeroValue, this.minOpacity );

		this.updateVis( colors );

		this.hideText();

	},

	updatePoses: function( posList ) {

		for ( let i = 0; i < posList.length; i ++ ) {

			this.outputUnitList[ i ].updatePos( posList[ i ] );

		}

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function OutputSegment( outputs, segmentLength, segmentIndex, totalLength, unitLength, color, minOpacity, initStatus, overview ) {

	this.outputs = outputs;
	this.segmentLength = segmentLength;
	this.segmentIndex = segmentIndex;
	this.totalLength = totalLength;
	this.unitLength = unitLength;
	this.color = color;
	this.minOpacity = minOpacity;
	this.initStatus = initStatus;
	this.overview = overview;

	this.totalSegments = Math.ceil( this.totalLength / this.segmentLength );
	this.groupLength = this.calcGroupLength();

	this.outputLength = this.groupLength;

	this.startIndex = undefined;
	this.endIndex = undefined;

	this.setRange();

	this.unitList = [];

	this.outputGroup = undefined;
	this.groupLengthNeedsUpdate = false;

	this.closeResultPos = [];
	this.openResultPos = [];

	for (let i = 0; i < this.groupLength; i ++ ) {

		this.closeResultPos.push( {

			x: 0,
			y: 0,
			z: 0

		} );

	}

	this.openResultPos = OutputNeuralPosGenerator.getLinePos( this.groupLength, this.unitLength );

	this.leftBoundary = this.openResultPos[ 0 ];
	this.rightBoundary = this.openResultPos[ this.segmentLength - 1 ];

	this.textNeuralIndex = undefined;

	this.init();

}

OutputSegment.prototype = {

	init: function() {

		this.unitList = this.createListElements();

		let outputGroup = new THREE.Object3D();

		for (let i = 0; i < this.unitList.length; i ++ ) {

			outputGroup.add( this.unitList[ i ].getElement() );

		}

		this.outputGroup = outputGroup;

		this.initStatus = "open";

	},

	createListElements: function() {

		let unitList = [];

		let unitsInitPos;

		if ( this.initStatus === "close" ) {

			unitsInitPos = this.closeResultPos;

		} else {

			unitsInitPos = this.openResultPos;

		}


		for ( let i = 0; i < this.groupLength; i ++ ) {

			let unitHandler = new OutputUnit(

				this.unitLength,
				this.outputs[ this.segmentLength * this.segmentIndex + i ],
				unitsInitPos[ i ],
				this.color,
				this.minOpacity,
				this.overview

			);

			unitHandler.setOutputIndex( i );

			unitList.push( unitHandler );

		}

		return unitList;

	},

	getElement: function() {

		return this.outputGroup;

	},

	updateVis: function( colors ) {

		for ( let i = 0; i < colors.length; i ++ ) {

			this.unitList[ i ].updateVis( [ colors[ i ] ] );

		}

	},

	clear: function() {

		let zeroData = new Int8Array( this.groupLength );
		let colors = ColorUtils.getAdjustValues( zeroData, this.minOpacity );

		this.updateVis( colors );

		this.hideText();

	},

	setLayerIndex: function( layerIndex ) {

		this.layerIndex = layerIndex;

		for ( let i = 0; i < this.unitList.length; i ++ ) {

			this.unitList[ i ].setLayerIndex( layerIndex );

		}

	},

	showText: function( selectedNeural ) {

		this.hideText();

		let selectedIndex = selectedNeural.outputIndex;

		this.unitList[ selectedIndex ].showText();
		this.textNeuralIndex = selectedIndex;

	},

	showTextWithIndex: function( index ) {

		if ( index >= this.segmentLength * this.segmentIndex &&
			index < Math.min( this.totalLength, this.segmentLength * ( this.segmentIndex + 1 ) ) ) {

			let selectedIndex = index - this.segmentLength * this.segmentIndex;

			this.unitList[ selectedIndex ].showText();
			this.textNeuralIndex = selectedIndex;

		}

	},

	hideText: function() {

		if ( this.textNeuralIndex !== undefined ) {

			this.unitList[ this.textNeuralIndex ].hideText();
			this.textNeuralIndex = undefined;

		}

	},

	updateSegmentIndex: function( segmentIndex ) {

		this.hideText();

		if (

			this.totalSegments * this.segmentLength !== this.totalLength &&
			(

				( this.segmentIndex !== this.totalSegments - 1 && segmentIndex === this.totalSegments - 1 ) ||
				( this.segmentIndex === this.totalSegments - 1 && segmentIndex !== this.totalSegments - 1 )

			)

		) {

			this.groupLengthNeedsUpdate = true;
			this.isLengthChanged = true;

		} else {

			this.isLengthChanged = false;

		}

		this.segmentIndex = segmentIndex;

		this.setRange();

		if ( this.groupLengthNeedsUpdate ) {

			this.updateLength();

		}

	},

	setRange: function() {

		this.startIndex = this.segmentLength * this.segmentIndex + 1;
		this.endIndex = Math.min( this.totalLength, this.segmentLength * ( this.segmentIndex + 1 ) );

	},

	calcGroupLength: function() {

		return Math.min( this.totalLength, this.segmentLength * ( this.segmentIndex + 1 ) ) - this.segmentLength * this.segmentIndex;

	},

	updateLength: function() {

		this.groupLength = this.calcGroupLength();
		this.outputLength = this.groupLength;

		for ( let i = 0; i < this.unitList.length; i ++ ) {

			this.outputGroup.remove( this.unitList[ i ].getElement() );

		}

		this.openResultPos = OutputNeuralPosGenerator.getLinePos( this.groupLength, this.unitLength );

		this.leftBoundary = this.openResultPos[ 0 ];
		this.rightBoundary = this.openResultPos[ this.openResultPos.length - 1 ];

		this.unitList = this.createListElements();

		this.setLayerIndex( this.layerIndex );

		for ( let i = 0; i < this.unitList.length; i ++ ) {

			this.outputGroup.add( this.unitList[ i ].getElement() );

		}

		this.groupLengthNeedsUpdate = false;

	},

	updatePoses: function( posList ) {

		for ( let i = 0; i < posList.length; i ++ ) {

			this.unitList[ i ].updatePos( posList[ i ] );

		}

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function PaginationButton( paginationType, size, unitLength, position, color, minOpacity ) {

	this.paginationType = paginationType;
	this.thickness = 2 * unitLength;
	this.size = size;
	this.unitLength = unitLength;
	this.minOpacity = minOpacity;

	this.position = {

		x: position.x,
		y: position.y,
		z: position.z

	};

	this.color = color;

	this.button = undefined;

	this.init();

}

PaginationButton.prototype = {

	init: function() {

		let texture = new THREE.TextureLoader().load( TextureProvider.getTexture( this.paginationType ) );

		let materialSide = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let materialTop = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: texture,
			transparent: true

		} );

		let materials = [];

		materials.push( materialSide );
		materials.push( materialTop );
		materials.push( materialTop );

		let cylinderRadius = this.size;

		let geometry = new THREE.CylinderBufferGeometry( cylinderRadius, cylinderRadius, this.thickness, 32 );
		let paginationButton = new THREE.Mesh( geometry, materials );

		paginationButton.position.set( this.position.x, this.position.y, this.position.z );
		paginationButton.clickable = true;
		paginationButton.elementType = "paginationButton";
		paginationButton.paginationType = this.paginationType;
		paginationButton.rotateY(  Math.PI / 2 );

		this.button = paginationButton;

	},

	getElement: function() {

		return this.button;

	},

	setLayerIndex: function( layerIndex ) {

		this.button.layerIndex = layerIndex;

	},

	updatePos: function( pos ) {

		this.position.x = pos.x;
		this.position.y = pos.y;
		this.position.z = pos.z;
		this.button.position.set( this.position.x, this.position.y, this.position.z );

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Output1d, output layer, can be initialized by TensorSpace user.
 *
 * @param config, user's configuration for Output1d.
 * @constructor
 */

function Output1d( config ) {

	// Output1d inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * Layer's output units.
	 *
	 * @type { int }
	 */

	this.width = undefined;

	/**
	 * Class names for each output unit.
	 *
	 * @type { Array }
	 */

	this.outputs = undefined;

	/**
	 * Output group's handler.
	 *
	 * @type { Object }
	 */

	this.outputHandler = undefined;

	/**
	 * aggregation's width and height.
	 * aggregation is an element which is displayed on the screen when Output1d is closed.
	 *
	 * @type { number }
	 */

	this.aggregationWidth = undefined;
	this.aggregationHeight = undefined;

	/**
	 * Decide how to display hint text.
	 *
	 * @type { boolean }
	 */

	this.overview = false;

	/**
	 * mode for how to display queue element
	 * If there is too many output units, use "paging" mode may have better visualization effect.
	 *
	 * @type { boolean }
	 */

	this.paging = false;

	/**
	 * Only take effect when this.paging = true.
	 * Segment length for "one page".
	 * Default to 200.
	 *
	 * @type { int }
	 */

	this.segmentLength = 200;

	/**
	 * Only take effect when this.paging = true.
	 * Which page NativeLayer1d displays now.
	 * Can be update when "last" or "next" buttons are clicked, initial value can be defined by user.
	 * Default to 0.
	 *
	 * @type { int }
	 */

	this.segmentIndex = 0;

	/**
	 * Only take effect when this.paging = true.
	 * How many pages in NativeLayer1d.
	 *
	 * @type { int }
	 */

	this.totalSegments = undefined;

	/**
	 * Only take effect when this.paging = true.
	 * Store handler for last button.
	 *
	 * @type { Object }
	 */

	this.lastButtonHandler = undefined;

	/**
	 * Only take effect when this.paging = true.
	 * Store handler for next button.
	 *
	 * @type { Object }
	 */

	this.nextButtonHandler = undefined;

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * False means that user need to add value for Output1d when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	// Load user's Output1d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Output1d";

}

Output1d.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * Output1d overrides NativeLayer's function:
	 * init, assemble, updateValue, clear, handleClick, handleHoverIn, handleHoverOut,
	 * calcCloseButtonSize, calcCloseButtonPos, getRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in Output1d, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to Output1d when call init() to initialize Output1d.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in Output1d.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		if ( this.isOpen ) {

			// Init output units, when layer is open, and put them into open position.

			this.initOutputElement( "open" );

			// Init close button.

			this.initCloseButton();

			if ( this.paging ) {

				// Init pagination button when layer is in "paging mode".

				this.showPaginationButton();

			}

		} else {

			// Init aggregation when layer is closed.

			this.initAggregationElement();

		}

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

		// Create relative line element.

		this.addLineGroup();

	},

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		// Conv2d layer's outputShape has one dimension.

		this.outputShape = [ this.width ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		if ( this.lastLayer.layerDimension === 1 ) {

			if ( this.lastLayer.layerType === "Input1d" ) {

				this.aggregationWidth = 3 * this.unitLength;
				this.aggregationHeight = 3 * this.unitLength;

			} else {

				this.aggregationWidth = this.lastLayer.aggregationWidth;
				this.aggregationHeight = this.lastLayer.aggregationHeight;

			}

		} else {

			this.aggregationWidth = this.lastLayer.actualWidth;
			this.aggregationHeight = this.lastLayer.actualHeight;

		}

	},

	/**
	 * updateValue() accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

		// Store layer output value in "neuralValue" attribute, this attribute can be get by TensorSpace user.

		this.neuralValue = value;

		if ( this.isOpen ) {

			// When Output1d is open, update visualization.

			this.updateOutputVis();

			// If text system is enabled, show max confident neural class text.

			let maxConfidenceIndex = OutputExtractor.getMaxConfidenceIndex( value );

			if ( this.textSystem ) {

				this.hideText();
				this.outputHandler.showTextWithIndex( maxConfidenceIndex );
				this.textElementHandler = this.outputHandler;

			}

		}

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

			if ( this.isOpen ) {

				// Use outputHandler to clear output units' visualization.

				this.outputHandler.clear();

			}

			// Clear layer data.

			this.neuralValue = undefined;

		}

	},

	/**
	 * handleClick() If clickable element in this layer is clicked, execute this handle function.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

		if ( clickedElement.elementType === "aggregationElement" ) {

			// If aggregation element is clicked, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If close button is clicked, close layer.

			this.closeLayer();

		} else if ( clickedElement.elementType === "outputNeural" ) {

			if ( this.textSystem ) {

				// If output unit is clicked and text system is enabled, show class name relative to the clicked unit.

				this.hideText();
				this.showText( clickedElement );

			}

		} else if ( clickedElement.elementType === "paginationButton" ) {

			// If pagination button is clicked, update segment.

			this.updatePage( clickedElement.paginationType );

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If relationSystem is enabled, show relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.showLines( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If relationSystem is enabled, hide relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.hideLines();

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Output1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.output1d;

		}

	},

	/**
	 * calcCloseButtonSize() get close button size.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		// To make close button's size responsive, width = 50 is the boundary.

		if ( this.width > 50 ) {

			return 2 * this.unitLength;

		} else {

			return 1.1 * this.unitLength;

		}

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() get close button position.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { JSON } position, close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		return {

			x: this.outputHandler.leftBoundary.x - 10 * this.unitLength,
			y: 0,
			z: 0

		};

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "outputNeural" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			return this.outputHandler.leftBoundary.x - this.calcCloseButtonPos().x + this.calcCloseButtonSize();

		} else {

			return this.aggregationWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * openLayer() open Output1d, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			// OutputTransitionFactory handles actual open animation, checkout "OutputTransitionTween.js" for more information.

			OutputTransitionFactory.openLayer( this );

		}

	},

	/**
	 * closeLayer() close Output1d, switch layer status from "open" to "close".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			// OutputTransitionFactory handles actual close animation, checkout "OutputTransitionTween.js" for more information.

			OutputTransitionFactory.closeLayer( this );

		}

	},

	/**
	 * loadLayerConfig() Load user's configuration into Output1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Output1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			if ( layerConfig.units !== undefined ) {

				this.width = layerConfig.units;

			} else {

				console.error( "\"units\" property is required for Ouput1d layer." );

			}

			this.outputs = layerConfig.outputs;

			if ( layerConfig.paging !== undefined ) {

				this.paging = layerConfig.paging;

				if ( this.paging ) {

					// If paging mode is set, load paging parameters.

					if ( layerConfig.segmentLength !== undefined ) {

						this.segmentLength = layerConfig.segmentLength;
						this.queueLength = this.segmentLength;
						this.totalSegments = Math.ceil( this.width / this.segmentLength );

					}

					if ( layerConfig.initSegmentIndex !== undefined ) {

						this.segmentIndex = layerConfig.initSegmentIndex;

					}

				}

			}

			if ( layerConfig.overview !== undefined ) {

				this.overview = layerConfig.overview;

			}

		}

	},

	/**
	 * initOutputElement() create output units's group, which is a THREE.js Object, configure it, and add it to neuralGroup in Output1d.
	 * Based on paging mode, outputHandler will be different.
	 *
	 * @param { string } initStatus, "open" or "close".
	 */

	initOutputElement: function( initStatus ) {

		let outputHandler;

		// Create different outputHandler in different mode.

		if ( this.paging ) {

			outputHandler = new OutputSegment(

				this.outputs,
				this.segmentLength,
				this.segmentIndex,
				this.width,
				this.unitLength,
				this.color,
				this.minOpacity,
				initStatus,
				this.overview

			);

		} else {

			outputHandler = new OutputQueue(

				this.width,
				this.outputs,
				this.unitLength,
				this.color,
				this.minOpacity,
				initStatus,
				this.overview

			);

		}

		// Set layer index to outputHandler, output units group object can know which layer it has been positioned.

		outputHandler.setLayerIndex( this.layerIndex );

		// Store handler for output group element for latter use.

		this.outputHandler = outputHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( outputHandler.getElement() );

		// Update output units group' visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateOutputVis();

		}

	},

	/**
	 * disposeOutputElement() remove output units group from neuralGroup, clear their handlers, and dispose their THREE.js Object in Output1d.
	 */

	disposeOutputElement: function() {

		this.neuralGroup.remove( this.outputHandler.getElement() );
		this.outputHandler = undefined;

	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in Output1d.
	 */

	initAggregationElement: function() {

		// QueueAggregation Object is a wrapper for aggregation element, checkout "QueueAggregation.js" for more information.

		let aggregationHandler = new QueueAggregation(

			this.aggregationWidth,
			this.aggregationHeight,
			this.actualDepth,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, aggregation object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( this.aggregationHandler.getElement() );

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in Output1d.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * updateOutputVis() update output units group's visualization.
	 */

	updateOutputVis: function() {

		// Get colors to render the surface of output units.

		let colors = ColorUtils.getAdjustValues( this.neuralValue, this.minOpacity );

		if ( this.paging ) {

			// Get part of colors to render segment.

			let segmentColors = colors.slice(

				this.segmentLength * this.segmentIndex,
				Math.min( this.segmentLength * ( this.segmentIndex + 1 ), this.width - 1 )

			);

			this.outputHandler.updateVis( segmentColors );

		} else {

			this.outputHandler.updateVis( colors );

		}

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		this.outputHandler.showText( element );
		this.textElementHandler = this.outputHandler;

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	},

	/**
	 * showPaginationButton() conditional add "next" button and "last" button into Output1d.
	 */

	showPaginationButton: function() {

		if ( this.segmentIndex === 0 && this.segmentIndex !== this.totalSegments - 1 ) {

			// First page only show "next" button.

			this.showNextButton();

		} else if ( this.segmentIndex !== 0 && this.segmentIndex === this.totalSegments - 1 ) {

			// last page only show "last" button.

			this.showLastButton();

		} else if ( this.segmentIndex === 0 && this.segmentIndex === this.totalSegments - 1 ) {

			// If only has one page, no button.

		} else {

			// In other situational, show two button.

			this.showNextButton();
			this.showLastButton();

		}

	},

	/**
	 * showLastButton() initialize "last" button, and add it to neuralGroup.
	 */

	showLastButton: function() {

		let lastButtonHandler = new PaginationButton(

			"last",
			this.calcPaginationButtonSize(),
			this.unitLength,
			this.calculatePaginationPos( "last" ),
			this.color,
			this.minOpacity

		);

		// Set layer index to "last" button, button object can know which layer it has been positioned.

		lastButtonHandler.setLayerIndex( this.layerIndex );

		this.lastButtonHandler = lastButtonHandler;
		this.neuralGroup.add( this.lastButtonHandler.getElement() );

	},

	/**
	 * showNextButton() initialize "next" button, and add it to neuralGroup.
	 */

	showNextButton: function() {

		let nextButtonHandler = new PaginationButton(

			"next",
			this.calcPaginationButtonSize(),
			this.unitLength,
			this.calculatePaginationPos( "next" ),
			this.color,
			this.minOpacity

		);

		// Set layer index to "next" button, button object can know which layer it has been positioned.

		nextButtonHandler.setLayerIndex( this.layerIndex );

		this.nextButtonHandler = nextButtonHandler;
		this.neuralGroup.add( this.nextButtonHandler.getElement() );

	},

	/**
	 * hidePaginationButton(), hide "last" button and "next" button.
	 */

	hidePaginationButton: function() {

		this.hideNextButton();
		this.hideLastButton();

	},

	/**
	 * hideNextButton(), hide "next" button.
	 */

	hideNextButton: function() {

		if ( this.nextButtonHandler !== undefined ) {

			this.neuralGroup.remove( this.nextButtonHandler.getElement() );
			this.nextButtonHandler = undefined;

		}

	},

	/**
	 * hideLastButton(), hide "last" button.
	 */

	hideLastButton: function() {

		if ( this.lastButtonHandler !== undefined ) {

			this.neuralGroup.remove( this.lastButtonHandler.getElement() );
			this.lastButtonHandler = undefined;

		}

	},

	/**                                                                                                                                                 y        y                        /**
	 * updatePage() execute actual page update work.
	 *
	 * @param { string } paginationType, "last" or "next".
	 */

	updatePage: function( paginationType ) {

		if ( paginationType === "next" ) {

			// "next" button is clicked.

			if ( this.segmentIndex === 0 ) {

				// First page now, click "next" button will show "last" button.

				this.showLastButton();

			}

			if ( this.segmentIndex === this.totalSegments - 2 ) {

				// Is going to the last page, the last page do not have "next" button.

				this.hideNextButton();

			}

			// Update segmentIndex.

			this.segmentIndex += 1;

		} else {

			// "last" button is clicked.

			if ( this.segmentIndex === this.totalSegments - 1 ) {

				// The Last page now, click "last" button will show "next" button.

				this.showNextButton();

			}

			if ( this.segmentIndex === 1 ) {

				// Is going to the first page, the first page do not have "last" button.

				this.hideLastButton();

			}

			// Update segmentIndex.

			this.segmentIndex -= 1;

		}

		// Modify segment element based on new segment index.

		this.outputHandler.updateSegmentIndex( this.segmentIndex );

		// Check whether queue length change, situation: the page's length may different with previous page.

		if ( this.outputHandler.isLengthChanged ) {

			if ( this.nextButtonHandler !== undefined ) {

				let nextButtonPos = this.calculatePaginationPos( "next" );
				this.nextButtonHandler.updatePos( nextButtonPos );

			}

			if ( this.lastButtonHandler !== undefined ) {

				let lastButtonPos = this.calculatePaginationPos( "last" );
				this.lastButtonHandler.updatePos( lastButtonPos );

			}

			let closeButtonPos = this.calcCloseButtonPos();
			this.closeButtonHandler.updatePos( closeButtonPos );

		}

		if ( this.neuralValue !== undefined ) {

			this.updateOutputVis();

		}

	},

	/**
	 * calcPaginationButtonSize() calculate button size.
	 *
	 * @return { number } size, pagination button size
	 */

	calcPaginationButtonSize: function() {

		// The size of pagination button is the same as close button in Output1d.

		return this.calcCloseButtonSize();

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() calculate the position of pagination button based on button type.
	 *
	 * @param { string } paginationType, "last" or "next".
	 * @return { Object } pagination button position, { x: double, y: double, z: double }, relative to layer.
	 */

	calculatePaginationPos: function( paginationType ) {

		if ( paginationType === "last" ) {

			// "last" button is positioned in the left of the layer.

			return {

				x: this.outputHandler.leftBoundary.x - 5 * this.unitLength,
				y: 0,
				z: 0

			};

		} else {

			// "next" button is positioned in the right of the layer.

			return {

				x: this.outputHandler.rightBoundary.x + 5 * this.unitLength,
				y: 0,
				z: 0

			};

		}

	}

} );

function OutputMap3d( width, height, unitLength, actualDepth, initCenter, color, minOpacity ) {

	this.width = width;
	this.height = height;
	this.depth = 3;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.width;
	this.actualHeight = this.unitLength * this.height;
	this.actualDepth = actualDepth;

	this.minOpacity = minOpacity;
	this.sideOpacity = SideFaceRatio * this.minOpacity;

	this.fmCenter = {

		x: initCenter.x,
		y: initCenter.y,
		z: initCenter.z

	};

	this.color = color;

	this.neuralLength = 3 * width * height;

	this.dataArray = undefined;
	this.dataTexture = undefined;

	this.ctx = undefined;
	this.canvasTexture = undefined;

	this.outputMap = undefined;
	this.outputGroup = undefined;

	this.font = TextFont;
	this.textSize = TextHelper.calcFmTextSize( this.actualWidth );

	this.init();

}

OutputMap3d.prototype = {

	init: function() {

		let canvas = document.createElement( "canvas" );
		canvas.width = this.width;
		canvas.height = this.height;

		this.ctx = canvas.getContext( "2d" );

		let canvasTexture = new THREE.Texture( canvas );

		this.canvasTexture = canvasTexture;

		let material;

		// suppress three.js image is not power of two warning

		console.warn = function(){};

		material = new THREE.MeshBasicMaterial( { map: canvasTexture } );

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.actualDepth, this.actualHeight );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			transparent: true,
			opacity: this.sideOpacity

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial

		];

		let cube = new THREE.Mesh( boxGeometry, materials );

		cube.elementType = "outputMap3d";
		cube.clickable = true;
		cube.hoverable = true;

		this.outputMap = cube;

		let outputGroup = new THREE.Object3D();
		outputGroup.position.set( this.fmCenter.x, this.fmCenter.y, this.fmCenter.z );
		outputGroup.add( this.outputMap );

		this.outputGroup = outputGroup;

		this.clear();

	},

	getElement: function() {

		return this.outputGroup;

	},

	clear: function() {

		let zeroData = new Int8Array( 3 * this.width * this.height );
		let zeroColors = ColorUtils.getAdjustValues( zeroData, this.minOpacity );

		this.updateVis( zeroColors, [] );

		this.canvasTexture.needsUpdate = true;

	},

	setLayerIndex: function( layerIndex ) {

		this.outputMap.layerIndex = layerIndex;

	},

	showText: function() {

		let widthInString = this.width.toString();
		let heightInString = this.height.toString();

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let widthGeometry = new THREE.TextGeometry( widthInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let widthText = new THREE.Mesh( widthGeometry, material );

		let widthTextPos = TextHelper.calcFmWidthTextPos(

			widthInString.length,
			this.textSize,
			this.actualWidth,
			{

				x: this.outputMap.position.x,
				y: this.outputMap.position.y,
				z: this.outputMap.position.z

			}

		);

		widthText.position.set(

			widthTextPos.x,
			widthTextPos.y,
			widthTextPos.z

		);

		widthText.rotateX( - Math.PI / 2 );

		let heightGeometry = new THREE.TextGeometry( heightInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let heightText = new THREE.Mesh( heightGeometry, material );

		let heightTextPos = TextHelper.calcFmHeightTextPos(

			heightInString.length,
			this.textSize,
			this.actualHeight,
			{

				x: this.outputMap.position.x,
				y: this.outputMap.position.y,
				z: this.outputMap.position.z

			}

		);

		heightText.position.set(

			heightTextPos.x,
			heightTextPos.y,
			heightTextPos.z

		);

		heightText.rotateX( - Math.PI / 2 );

		this.widthText = widthText;
		this.heightText = heightText;

		this.outputGroup.add( this.widthText );
		this.outputGroup.add( this.heightText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.outputGroup.remove( this.widthText );
		this.outputGroup.remove( this.heightText );
		this.widthText = undefined;
		this.heightText = undefined;

		this.isTextShown = false;

	},

	updateVis: function( imageData, rectList ) {

		this.drawImage( imageData );
		this.drawRectangles( rectList );

		this.canvasTexture.needsUpdate = true;

	},

	drawRectangles: function( rectList ) {

		for ( let i = 0; i < rectList.length; i ++ ) {

			let rectParameter = rectList[ i ];

			this.drawRect(

				rectParameter.x,
				rectParameter.y,
				rectParameter.width,
				rectParameter.height

			);

		}

	},

	drawRect: function( x, y, width, height ) {

		this.ctx.rect( x, y, width, height );
		this.ctx.stroke();

	},

	drawImage: function( data ) {

		let imageData = this.ctx.getImageData( 0, 0, this.width, this.height );

		let imageDataValue = imageData.data;

		let count = 0;

		for ( let i = 0; i < imageDataValue.length; i ++ ) {

			if ( i % 4 !== 3 ) {

				imageDataValue[ i ] = 255 * data[ count ];
				count++;

			} else {

				imageDataValue[ i ]  = 255;

			}

		}

		this.ctx.putImageData( imageData, 0, 0 );

	},

	setPositionedLayer: function( layerType ) {
		this.outputMap.positionedLayer = layerType;
	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * OutputDetection, output layer, can be initialized by TensorSpace user.
 *
 * 2D output, shape is the same as input, can draw rectangles on it, can be used to show object detection result.
 *
 * @param config, user's configuration for OutputDetection.
 * @constructor
 */

function OutputDetection( config ) {

	// OutputDetection inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * OutputDetection has three output dimensions: [ width, height, depth ]
	 *
	 * @type { int }
	 */

	this.width = undefined;
	this.height = undefined;
	this.depth = 3;

	/**
	 * Store outputMap handler.
	 *
	 * @type { Object }
	 */

	this.outputHandler = undefined;

	/**
	 * Store rectangle parameters drawn on it.
	 * Each rectangle has a JSON parameter, the parameter is like:
	 * {
	 * 		x: x,
	 * 		y: y,
	 * 		width: width,
	 * 		height: height,
	 * }
	 *
	 * @type { Array }
	 */

	this.rectangleList = [];

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * True means that user do not need to add value for OutputDetection value when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = true;

	// Load user's OutputDetection configuration.

	this.loadLayerConfig( config );

	this.layerType = "OutputDetection";

}

OutputDetection.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * OutputDetection overrides NativeLayer's function:
	 * init, assemble, updateValue, clear, handleClick, handleHoverIn, handleHoverOut,
	 * calcCloseButtonSize, calcCloseButtonPos, getRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in OutputDetection, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to OutputDetection when call init() to initialize OutputDetection.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in OutputDetection.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		if ( this.isOpen ) {

			// Init output element.

			this.initOutput();

			// Init close button.

			this.initCloseButton();

		} else {

			// Init aggregation when layer is closed.

			this.initAggregationElement();

		}

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

		// Create relative line element.

		this.addLineGroup();

	},

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		// Automatically detect model's input shape as outputShape.

		let modelInputShape = this.model.layers[ 0 ].outputShape;

		this.width = modelInputShape[ 0 ];
		this.height = modelInputShape[ 1 ];

		this.inputShape = this.lastLayer.outputShape;

		this.outputShape = [ this.width, this.height, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.lastLayer.actualWidth;
		this.actualHeight = this.lastLayer.actualHeight;

	},

	/**
	 * updateValue(), get layer value from model's input value.
	 */

	updateValue: function() {

		this.neuralValue = this.model.inputValue;

		this.updateOutputVis();

	},

	/**
	 * clear(), clear layer value and visualization.
	 */

	clear: function() {

		this.neuralValue = undefined;

		if ( this.outputHandler !== undefined ) {

			this.outputHandler.clear();

		}

	},

	/**
	 * handleClick() If clickable element in this layer is clicked, execute this handle function.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

		if ( clickedElement.elementType === "aggregationElement" ) {

			// If aggregation element is clicked, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If close button is clicked, close layer.

			this.closeLayer();

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If relationSystem is enabled, show relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.showLines( hoveredElement );

		}

		// If textSystem is enabled, show hint text, for example, show output map size.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If relationSystem is enabled, hide relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.hideLines();

		}

		// If textSystem is enabled, hide hint text, for example, hide output map size.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * loadModelConfig() load model's configuration into OutputDetection object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.outputDetection;

		}

	},

	/**
	 * calcCloseButtonSize() get close button size.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		return this.unitLength * this.width * CloseButtonRatio;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() get close button position.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { JSON } position, close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		return {

			x: - this.unitLength * this.width / 2 - 20 * this.unitLength,
			y: 0,
			z: 0

		};

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "outputMap3d" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			return this.width * this.unitLength / 2 - this.calcCloseButtonPos().x + this.calcCloseButtonSize();

		} else {

			return this.actualWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * addRectangleList() add rectangles to output map.
	 * Each rectangle has a JSON parameter, the parameter is like:
	 * {
	 * 		x: x,
	 * 		y: y,
	 * 		width: width,
	 * 		height: height,
	 * }
	 *
	 * This API is exposed to TensorSpace user.
	 *
	 * @param { Array } rectList, rectangle parameters list.
	 */

	addRectangleList: function( rectList ) {

		// Store rectangle parameters data.

		this.rectangleList = rectList;

		// If layer is open, update output map's visualization.

		if ( this.isOpen ) {

			this.updateOutputVis();

		}

	},

	/**
	 * openLayer() open OutputDetection, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			this.isOpen = true;

			this.disposeAggregationElement();
			this.initOutput();
			this.updateOutputVis();
			this.initCloseButton();

		}

	},

	/**
	 * closeLayer() close OutputDetection, switch layer status from "open" to "close".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			this.isOpen = false;

			this.disposeOutput();
			this.disposeCloseButton();
			this.initAggregationElement();

		}

	},

	loadLayerConfig: function( layerConfig ) {



	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in OutputDetection.
	 */

	initAggregationElement: function() {

		// QueueAggregation Object is a wrapper for aggregation, checkout "QueueAggregation.js" for more information.

		let aggregationHandler = new QueueAggregation(

			this.actualWidth,
			this.actualHeight,
			this.actualDepth,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, aggregation object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( this.aggregationHandler.getElement() );

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in OutputDetection.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * initOutput() create layer output map's THREE.js Object, configure it, and add it to neuralGroup in OutputDetection.
	 */

	initOutput: function() {

		// OutputMap3d Object is a wrapper for output map, checkout "MapAggregation.js" for more information.

		let outputHandler = new OutputMap3d(

			this.width,
			this.height,
			this.unitLength,
			this.actualDepth,
			{

				x: 0,
				y: 0,
				z: 0

			},
			this.color,
			this.minOpacity

		);

		// Set layer index to output map, output map object can know which layer it has been positioned.

		outputHandler.setLayerIndex( this.layerIndex );

		// Store handler for output map for latter use.

		this.outputHandler = outputHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( this.outputHandler.getElement() );

		// Update output map's visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateOutputVis();

		}

	},

	/**
	 * disposeOutput() remove output map from neuralGroup, clear its handler, and dispose its THREE.js Object in OutputDetection.
	 */

	disposeOutput: function() {

		this.neuralGroup.remove( this.outputHandler.getElement() );
		this.outputHandler = undefined;

	},

	/**
	 * updateSegregationVis() update output map's visualization.
	 */

	updateOutputVis: function() {

		if ( this.isOpen ) {

			// Get colors to render the surface of output map.

			let colors = ColorUtils.getAdjustValues( this.neuralValue, this.minOpacity );

			// handler execute update.

			this.outputHandler.updateVis( colors, this.rectangleList );

		}

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function(element) {

		if ( element.elementType === "outputMap3d" ) {

			this.outputHandler.showText();
			this.textElementHandler = this.outputHandler;

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function YoloOutputUnit( unitLength, initPosition, color, minOpacity ) {

	this.unitLength = unitLength;
	this.width = 2 * this.unitLength;

	this.position = {

		x: initPosition.x,
		y: initPosition.y,
		z: initPosition.z

	};

	this.color = color;
	this.minOpacity = minOpacity;

	this.outputNeural = undefined;
	this.outputGroup = undefined;

	this.init();

}

YoloOutputUnit.prototype = {

	init: function() {

		let outputGroup = new THREE.Object3D();

		let boxGeometry = new THREE.BoxBufferGeometry( this.width, this.width, this.width );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let cube = new THREE.Mesh( boxGeometry, material );
		cube.elementType = "outputNeural";
		cube.clickable = true;
		cube.hoverable = true;

		cube.position.set(

			this.position.x,
			this.position.y,
			this.position.z

		);

		this.outputNeural = cube;

		outputGroup.add( cube );
		this.outputGroup = outputGroup;

	},

	getElement: function() {

		return this.outputGroup;

	},

	setLayerIndex: function( layerIndex ) {

		this.outputNeural.layerIndex = layerIndex;

	},

	setOutputIndex: function( outputIndex ) {

		this.outputNeural.outputIndex = outputIndex;

	},

	setPositionedLayer: function( layerType ) {

		this.outputNeural.positionedLayer = layerType;

	},

	updatePos: function( pos ) {

		this.position.x = pos.x;
		this.position.y = pos.y;
		this.position.z = pos.z;
		this.outputGroup.position.set( this.position.x, this.position.y, this.position.z );

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

let YoloTweenFactory = ( function() {

	function openLayer( layer ) {

		layer.disposeAggregationElement();
		layer.initSegregationElements( layer.closeResultPos );

		let init = {

			ratio: 0

		};

		let end = {

			ratio: 1

		};

		let yoloOutputTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		yoloOutputTween.onUpdate( function() {

			for ( let i = 0; i < layer.segregationHandlers.length; i ++ ) {

				let tempPos = {

					x: init.ratio * ( layer.openResultPos[ i ].x - layer.closeResultPos[ i ].x ),
					y: init.ratio * ( layer.openResultPos[ i ].y - layer.closeResultPos[ i ].y ),
					z: init.ratio * ( layer.openResultPos[ i ].z - layer.closeResultPos[ i ].z )

				};

				layer.segregationHandlers[ i ].updatePos( tempPos );

			}

		} ).onStart( function() {

			layer.isWaitOpen = false;
			layer.isOpen = true;

		} ).onComplete( function() {

			layer.initCloseButton();

		} );

		yoloOutputTween.start();

		layer.isWaitOpen = true;

	}

	function closeLayer( layer ) {

		let init = {

			ratio: 1

		};
		let end = {

			ratio: 0

		};

		let fmTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		fmTween.onUpdate( function() {

			for ( let i = 0; i < layer.segregationHandlers.length; i ++ ) {

				let tempPos = {

					x: init.ratio * ( layer.openResultPos[ i ].x - layer.closeResultPos[ i ].x ),
					y: init.ratio * ( layer.openResultPos[ i ].y - layer.closeResultPos[ i ].y ),
					z: init.ratio * ( layer.openResultPos[ i ].z - layer.closeResultPos[ i ].z )

				};

				layer.segregationHandlers[ i ].updatePos( tempPos );

			}

		} ).onStart( function() {

			layer.disposeCloseButton();

		} ).onComplete( function() {

			layer.disposeSegregationElements();
			layer.initAggregationElement();

			layer.isWaitClose = false;
			layer.isOpen = false;

		} );

		fmTween.start();

		layer.isWaitClose = true;

	}

	return {

		openLayer: openLayer,

		closeLayer: closeLayer

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 * @author Charlesliuyx / https://github.com/Charlesliuyx
 */

let YoloResultGenerator = (function() {

    // utils function
    function sigmoid( x ) {

        return 1 / ( 1 + Math.pow( Math.E, - x ) );

    }

    function softmax( arr ) {

        const C = Math.max( ...arr );

        const d = arr.map( ( y ) => Math.exp( y - C ) ).reduce( ( a, b ) => a + b );

        return arr.map( ( value, index ) => {

            return Math.exp( value - C ) / d;

        } )

    }

    // Ascend
    function sortBy(field) {

        return function(a,b) {

            return b[field] - a[field];

        }

    }

    //TODO implement iou & nms

	function transferPrediction( prediction ) {

    	// prediction = {x:, y:, width:, height:, finalScore:, labelName:}
		// return a list of [ x1, y1, x2, y2]

    	let list = [];

    	list.push( prediction["x"] );
    	list.push( prediction["y"] );
    	list.push( prediction["x"] + prediction["width"]);
    	list.push( prediction["y"] + prediction["height"]);

    	return list;

	}

	function iou( boxA, boxB ) {

    	// boxA = boxB = [ x1, y1, x2, y2 ]
		// (x1, y1) for left-top point
		// (x2, y2) for right-bottom point

		let xA = Math.max( boxA[0], boxB[0] );
		let yA = Math.max( boxA[1], boxB[1] );
		let xB = Math.min( boxA[2], boxB[2] );
		let yB = Math.min( boxA[3], boxB[3] );

		// Compute the area of intersection
		let intersectionArea = ( xB - xA + 1) * ( yB - yA + 1 );

		// Compute the area of both rectangles
		let boxAArea = ( boxA[2] - boxA[0] + 1 ) * ( boxA[3] - boxA[1] + 1 );
		let boxBArea = ( boxB[2] - boxB[0] + 1 ) * ( boxB[3] - boxB[1] + 1 );

		// Compute the IOU

		return intersectionArea / ( boxAArea + boxBArea - intersectionArea );

	}

	function nonMaximalSuppression( thresholdedPredictions, iouThreshold ){

    	// thresholdedPredcitions: is an array with predictive results

		let nmsPredictions = [];

		nmsPredictions.push( thresholdedPredictions[0] );

		let i = 1;

		let toDelete = false;

		while ( i < thresholdedPredictions.length ) {

			let nBoxesToCheck = nmsPredictions.length;

			toDelete = false;

			let j = 0;

			while ( j < nBoxesToCheck ) {

				let boxA = transferPrediction( thresholdedPredictions[i] );

				let boxB = transferPrediction( nmsPredictions[j] );

				let curIOU = iou( boxA, boxB );

				if ( curIOU > iouThreshold ) {

					toDelete = true;

				}

                j++;

			}

			if ( toDelete === false )  {

				nmsPredictions.push( thresholdedPredictions[i] );

			}

			i++;

		}

		return nmsPredictions;

	}

    function checkRange(x, range) {

        return x >= 0 && x <= range;

    }

    function getDetectedBox( neuralData, channelDepth, channelShape, outputShape,
                             anchors, classLabelList, scoreThreshold, iouThreshold,
							 isNMS) {

        // neuralData : array [71825] for coco; [21125] for VOC
        // channelShape ： array = [13, 13]
        // outputShape : array = [416, 416] output image pixel

        let widthRange = channelShape[ 0 ];
        let heightRange = channelShape[ 1 ];

        let thresholdedPredictions = [];

        let output = [];

		for ( let row = 0; row < widthRange; row ++ ) {

			for ( let col = 0; col < heightRange; col ++ ) {

				let start = row * widthRange + col;

				let channelData = neuralData.slice( start * channelDepth, ( start + 1 ) * channelDepth );

                let len = channelData.length / 5;

				for ( let box = 0; box < anchors.length / 2; box ++ ) {

                    let index = box * len;
                    let bx = ( sigmoid( channelData[ index ] ) + col );
                    let by = ( sigmoid( channelData[ index + 1 ] ) + row );
                    let bw = anchors[ box * 2 ] * Math.exp( channelData[ index + 2 ] );
                    let bh = anchors[ box * 2 + 1 ] * Math.exp( channelData[ index + 3 ] );

                    let finalConfidence = sigmoid( channelData[ index + 4 ] );

                    let probability = channelData.slice( index + 5, index + len );

                    let classPrediction = softmax( probability );

                    let bestClassIndex = classPrediction.indexOf( Math.max( ...classPrediction ) );

                    let bestClassLabel = classLabelList[ bestClassIndex ];

                    let bestClassScore = classPrediction[ bestClassIndex ];

                    let finalScore = bestClassScore * finalConfidence;

                    let width = bw / widthRange * outputShape[ 0 ];
                    let height = bh  / heightRange * outputShape[ 1 ];
                    let x = bx / widthRange * outputShape[ 0 ] - width / 2;
                    let y = by / heightRange * outputShape[ 1 ] - height / 2;

                    if ( finalScore > scoreThreshold ) {

                        thresholdedPredictions.push( {
                            "x": x,
                            "y": y,
                            "width": width,
                            "height": height,
							"finalScore": finalScore,
							"className": bestClassLabel
                        } );

                        if ( isNMS === false ) {

                            output.push( {

                                x: x,
                                y: y,
                                width: width,
                                height: height

                            });

                        }

                    }

				}

			}

		}

		thresholdedPredictions.sort(sortBy("finalScore"));

		let nmsPredictions = nonMaximalSuppression( thresholdedPredictions, iouThreshold );

		if ( isNMS === true ) {

            for ( let i = 0; i < nmsPredictions.length; i++ ) {

                output.push( {

                    x: nmsPredictions[i]["x"],
                    y: nmsPredictions[i]["y"],
                    width: nmsPredictions[i]["width"],
                    height: nmsPredictions[i]["height"],

                });

            }

		}


		return output;

	}

	function getChannelBox( channelData, channelShape, outputShape,
                            anchors, classLabelList, scoreThreshold, iouThreshold, isDrawFiveBoxes,
							cx, cy ) {

        // channelData : array [425] for coco; [125] for VOC
        // channelShape ： array [2] [13, 13]
        // outputShape : array [2] [416, 416] output image pixel
        // cx is col of feature map [13, 13]
        // cy is row of feature map [13, 13]

		let widthRange = channelShape[ 0 ];
		let heightRange = channelShape[ 1 ];

		let len = channelData.length / 5;

		let output = [];

		for ( let box = 0; box < anchors.length / 2; box ++ ) {

			let index = box * len;
			let bx = ( sigmoid( channelData[ index ] ) + cx );
			let by = ( sigmoid( channelData[ index + 1 ] ) + cy );
			let bw = anchors[ box * 2 ] * Math.exp( channelData[ index + 2 ] );
			let bh = anchors[ box * 2 + 1 ] * Math.exp( channelData[ index + 3 ] );

			let finalConfidence = sigmoid( channelData[ index + 4 ] );

			let classPrediction = softmax( channelData.slice( index + 5, index + len ) );

			let bestClassIndex = classPrediction.indexOf( Math.max( ...classPrediction ) );

			let bestClassScore = classPrediction[ bestClassIndex ];

			let finalScore = bestClassScore * finalConfidence;

			let width = bw / widthRange * outputShape[ 0 ];
			let height = bh  / heightRange * outputShape[ 1 ];
			let x = bx / widthRange * outputShape[ 0 ] - width / 2;
			let y = by / heightRange * outputShape[ 1 ] - height / 2;

            if ( isDrawFiveBoxes ||
                ( checkRange( bx, widthRange ) && checkRange( by, heightRange ) &&
				  checkRange( bw, widthRange ) && checkRange( bh, heightRange ) &&
				  finalScore > scoreThreshold
                )
            ) {

				output.push( {

					x: x,
					y: y,
					width: width,
					height: height,

				} );

			}

		}

		return output;

	}

	return {

		getChannelBox: getChannelBox,

        getDetectedBox: getDetectedBox

	}

})();

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * YoloGrid, output layer, can be initialized by TensorSpace user.
 * In yolo, the input image is divided into an S x S grid of cells,
 * this layer presents each ceil as an cube for user to click,
 * and get predict result in each ceil from callback function.
 *
 * @param config, user's configuration for YoloGrid.
 * @constructor
 */

function YoloGrid( config ) {

	// YoloGrid inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * Grid ceil's handlers list.
	 *
	 * @type { Array }
	 */

	this.segregationHandlers = [];

	/**
	 * Callback function, fired when ceil are clicked.
	 *
	 * @type { function }
	 */

	this.onCeilClicked = undefined;

	/**
	 * Output shape: [ widthNum, heightNum ].
	 *
	 * @type { int }
	 */

	this.widthNum = undefined;
	this.heightNum = undefined;

	/**
	 * Total grid ceil number.
	 *
	 * @type { int }
	 */

	this.totalCeil = undefined;

	/**
	 * Depth for each grid ceil.
	 *
	 * @type { int }
	 */

	this.channelDepth = undefined;

	/**
	 * Grid ceil's centers when layer is closed.
	 *
	 * @type { Array }
	 */

	this.closeResultPos = [];

	/**
	 * Grid ceil's centers when layer is totally open.
	 *
	 * @type { Array }
	 */

	this.openResultPos = [];

	/**
	 * Sets from a predetermined set of boxes with particular height-width ratios for Yolo Detection.
	 * Stored as an array, for example,
	 * in VOC data set, anchors: [ 1.08, 1.19, 3.42, 4.41, 6.63, 11.38, 9.42, 5.11, 16.62, 10.52 ]
	 *
	 * @type { Array } float
	 */

	this.anchors = undefined;

    /**
     * The label list configuration.
     * For example, in VOC data set, label: [ "aeroplane", "bicycle", "bird", "boat", "bottle",
     * "bus", "car", "cat", "chair", "cow", "diningtable", "dog", "horse", "motorbike", "person",
     * "pottedplant", "sheep", "sofa", "train", "tvmonitor" ]
     *
     * @type { Array } string
     */

    this.classLabelList = undefined;

    /**
     * The threshold to constrain the output baseline.
     * The larger the value, the higher the confidence value of the detected object need.
     * [Default] 0.5
	 *
     * @type { float }
     */

    this.scoreThreshold = 0.5;

    /**
     * The toggle to control whether to draw all 5 boxes in each grid.
     * Usually be used to how how yolo network generate the final detective boxes.
     * [Default] false, means to draw the final result.
     * @type { bool }
     */

    this.isDrawFiveBoxes = false;

    /**
     * The toggle to control whether to apply non-maximum suppression to the detection rectangles .
     * [Default] true, means to apply nms.
     * @type { bool }
     */

    this.isNMS = true;

    /**
	 * Model's input shape, the shape is the same as model's input layer.
	 *
	 * @type { Array }
	 */

	this.modelInputShape = undefined;

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * True means that user do not need to add value for YoloGrid value when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = true;

	// Load user's YoloGrid configuration.

	this.loadLayerConfig( config );

	this.layerType = "YoloGrid";

}

YoloGrid.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * YoloGrid overrides NativeLayer's function:
	 * init, assemble, updateValue, clear, handleClick, handleHoverIn, handleHoverOut, loadModelConfig,
	 * calcCloseButtonSize, calcCloseButtonPos, getRelativeElements, provideRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in YoloGrid, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to YoloGrid when call init() to initialize YoloGrid.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in YoloGrid.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		if ( this.isOpen ) {

			// Init all grid ceil and display them to totally opened positions.

			this.initSegregationElements( this.openResultPos );

			// Init close button.

			this.initCloseButton();

		} else {

			// Init aggregation when layer is closed.

			this.initAggregationElement();

		}

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

		// Create relative line element.

		this.addLineGroup();

	},

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function ( layerIndex ) {

		this.layerIndex = layerIndex;

		// Auto detect input shape from last layer.

		this.inputShape = this.lastLayer.outputShape;

		// Infer layer shape from input shape.

		this.widthNum = this.inputShape[ 0 ];
		this.heightNum = this.inputShape[ 1 ];
		this.channelDepth = this.inputShape[ 2 ];
		this.outputShape = [ this.widthNum, this.heightNum ];

		this.modelInputShape = this.model.layers[ 0 ].outputShape;

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.lastLayer.actualWidth;
		this.actualHeight = this.lastLayer.actualHeight;

		this.totalCeil = this.widthNum * this.heightNum;

		// Calculate the grid ceil's centers for closed status.

		for (let i = 0; i < this.totalCeil; i ++ ) {

			this.closeResultPos.push( {

				x: 0,
				y: 0,
				z: 0

			} );

		}

		// Calculate the grid ceil's centers for open status.

		this.openResultPos = this.calcOpenResultPos();

	},

	/**
	 * updateValue(), get layer value from last layer.
	 */

	updateValue: function() {

		this.neuralValue = this.lastLayer.neuralValue;

	},

	/**
	 * clear(), clear layer value.
	 */

	clear: function() {

		this.neuralValue = undefined;

	},

	/**
	 * handleClick() If clickable element in this layer is clicked, execute this handle function.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function ( clickedElement ) {

		if ( clickedElement.elementType === "aggregationElement" ) {

			// If aggregation element is clicked, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If close button is clicked, close layer.

			this.closeLayer();

		} else if ( clickedElement.elementType === "outputNeural" ) {

			// If grid ceil click, fire callback function.

			this.handleCeilClicked( clickedElement );

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If relationSystem is enabled, show relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.showLines( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If relationSystem is enabled, hide relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.hideLines();

		}

	},

	/**
	 * loadModelConfig() load model's configuration into YoloGrid object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function ( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.yoloGrid;

		}

	},

	/**
	 * calcCloseButtonSize() get close button size.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		return CloseButtonRatio * ( this.openResultPos[ this.openResultPos.length - 1 ].z - this.openResultPos[ 0 ].z );

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() get close button position.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { JSON } position, close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		return {

			x: this.openResultPos[ 0 ].x - 10 * this.unitLength,
			y: 0,
			z: 0

		};

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function ( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "outputNeural" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		if ( request.all !== undefined && request.all ) {

			// When "all" attribute in request is true, return all elements displayed in this layer.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

					relativeElements.push( this.segregationHandlers[ i ].getElement() );

				}

			} else {

				relativeElements.push( this.aggregationHandler.getElement() );

			}

		} else {

			if ( request.index !== undefined ) {

				if ( this.isOpen ) {

					// If index attribute is set in request, and layer is open, return feature map element which has the same index.

					relativeElements.push( this.segregationHandlers[ request.index ].getElement() );

				} else {

					// If layer is closed, return aggregation element.

					relativeElements.push( this.aggregationHandler.getElement() );

				}

			}

		}

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			let maxX = this.openResultPos[ 0 ].x;

			for ( let i = 0; i < this.openResultPos.length; i ++ ) {

				maxX = this.openResultPos[ i ] > maxX ? this.openResultPos[ i ] : maxX;

			}

			return maxX - this.calcCloseButtonPos().x + this.calcCloseButtonSize();

		} else {

			return this.actualWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * openLayer() open YoloGrid, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			// YoloTweenFactory handles actual open animation, checkout "YoloTransitionTween.js" for more information.

			YoloTweenFactory.openLayer( this );

		}

	},

	/**
	 * closeLayer() close YoloGrid, switch layer status from "open" to "close".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			// YoloTweenFactory handles actual close animation, checkout "YoloTransitionTween.js" for more information.

			YoloTweenFactory.closeLayer( this );

		}

	},

	/**
	 * handleCeilClicked(), handle user's click on ceil element, execute callback if configured.
	 *
	 * @param { THREE.Object } clickedElement
	 */

	handleCeilClicked: function(clickedElement ) {

		if ( this.onCeilClicked !== undefined ) {

			let outputIndex = clickedElement.outputIndex;

			let widthIndex = outputIndex % this.widthNum;
			let heightIndex = Math.floor( outputIndex / this.widthNum );

			let ceilData = this.getCeilOutputValues( outputIndex );

			let rectangleList = [];

			if ( widthIndex === 0 && heightIndex === 0 ) {

				// To get the boxes with detective objects.

				rectangleList = YoloResultGenerator.getDetectedBox(
					this.neuralValue,
                    this.channelDepth,
					this.outputShape,
                    this.modelInputShape,
                    this.anchors,
                    this.classLabelList,
                    this.scoreThreshold,
					this.iouThreshold,
                    this.isNMS,
				);

			} else {

				// Use YoloResultGenerator get rects.

                rectangleList = YoloResultGenerator.getChannelBox(
                    ceilData,
                    this.outputShape,
                    this.modelInputShape,
                    this.anchors,
                    this.classLabelList,
                    this.scoreThreshold,
                    this.iouThreshold,
                    this.isDrawFiveBoxes,
                    widthIndex,
                    heightIndex
                );

            }

			// Pass two parameters, ceilData and rectangleList, to callback function.

			this.onCeilClicked( ceilData, rectangleList );

		}

	},

	/**
	 * loadLayerConfig() Load user's configuration into YoloGrid.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for YoloGrid.
	 */

	loadLayerConfig: function ( layerConfig ) {

		this.loadBasicLayerConfig( layerConfig );

		if ( layerConfig !== undefined ) {

			// Load optional callback function.

			if ( layerConfig.onCeilClicked !== undefined ) {

				this.onCeilClicked = layerConfig.onCeilClicked;

			}

			// Load required anchors.

			if ( layerConfig.anchors !== undefined ) {

				this.anchors = layerConfig.anchors;

			} else {

				console.error( "\"anchors\" property is required for YoloGrid layer." );

			}

			// Load required label name list

            if ( layerConfig.classLabelList !== undefined ) {

                this.classLabelList = layerConfig.classLabelList;

            } else {

                console.error( "\"anchors\" property is required for YoloGrid layer." );

            }

            this.scoreThreshold = layerConfig.scoreThreshold;

            this.iouThreshold = layerConfig.iouThreshold;

            this.isDrawFiveBoxes = layerConfig.isDrawFiveBoxes;

			this.isNMS = layerConfig.isNMS;

		}

	},

	/**
	 * initSegregationElements() create feature maps's THREE.js Object, configure them, and add them to neuralGroup in YoloGrid.
	 *
	 * @param { JSON[] } centers, list of feature map's center (x, y, z), relative to layer
	 */

	initSegregationElements: function( centers ) {

		for (let i = 0; i < this.totalCeil; i ++ ) {

			// YoloOutputUnit is a wrapper for one grid ceil, checkout "YoloOutputUnit.js" for more information.

			let segregationHandler = new YoloOutputUnit(

				this.unitLength,
				centers[ i ],
				this.color,
				this.minOpacity

			);

			// Set layer index to YoloOutputUnit, grid ceil object can know which layer it has been positioned.

			segregationHandler.setLayerIndex( this.layerIndex );

			// Set grid ceil index.

			segregationHandler.setOutputIndex( i );

			// Store handler for grid ceil for latter use.

			this.segregationHandlers.push( segregationHandler );

			// Get actual THREE.js element and add it to layer wrapper Object.

			this.neuralGroup.add( segregationHandler.getElement() );

		}

	},

	/**
	 * disposeSegregationElements() remove feature maps from neuralGroup, clear their handlers, and dispose their THREE.js Object in YoloGrid.
	 */

	disposeSegregationElements: function() {

		for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

			// Remove grid ceil' THREE.js object from neuralGroup.

			this.neuralGroup.remove( this.segregationHandlers[ i ].getElement() );

		}

		// Clear handlers, actual objects will automatically be GC.

		this.segregationHandlers = [];

	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in YoloGrid.
	 */

	initAggregationElement: function() {

		// QueueAggregation Object is a wrapper for grid ceil's aggregation, checkout "QueueAggregation.js" for more information.

		let aggregationHandler = new QueueAggregation(

			this.actualWidth,
			this.actualHeight,
			this.actualDepth,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, aggregation object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( this.aggregationHandler.getElement() );

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in YoloGrid.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * getCeilOutputValues(), generate grid ceil's value from raw yolo output.
	 *
	 * @param { int } outputIndex, grid ceil's index
	 * @returns { Array }, grid ceil value
	 */

	getCeilOutputValues: function( outputIndex ) {

		let singleOutput = [];

		if ( this.neuralValue !== undefined ) {

			singleOutput = this.neuralValue.slice( this.channelDepth * outputIndex, this.channelDepth * ( outputIndex + 1 ) );

		}

		return singleOutput;

	},

	/**
	 * Grid ceils are positioned in a square shape.
	 *
	 * @returns { Array }, positions for grid ceil element, relative to layer.
	 */

	calcOpenResultPos: function() {

		let openResultList = [];

		let initXTranslate = - 2 * ( this.widthNum - 1 ) * this.unitLength;
		let initZTranslate = - 2 * ( this.heightNum - 1 ) * this.unitLength;

		let distance = 4 * this.unitLength;

		for ( let i = 0; i < this.widthNum; i ++ ) {

			for ( let j = 0; j < this.heightNum; j ++ ) {

				openResultList.push( {

					x: initXTranslate + distance * j,
					y: 0,
					z: initZTranslate + distance * i

				} );

			}

		}

		return openResultList;

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function VariableLengthObject( width, height, depth, color, minOpacity ) {

	this.width = width;
	this.height = height;
	this.depth = depth;
	this.color = color;

	this.sideOpacity = SideFaceRatio * minOpacity;

	this.element = undefined;

	this.init();

}

VariableLengthObject.prototype = {

	init: function() {

		let geometry = new THREE.BoxBufferGeometry( this.width, this.depth, this.height );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.sideOpacity,
			transparent: true

		} );

		let variableLengthObject = new THREE.Mesh( geometry, material );
		variableLengthObject.position.set( 0, 0, 0 );

		this.element = variableLengthObject;

	},

	getElement: function() {

		return this.element;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

let QueueTransitionFactory = ( function() {

	function openLayer( layer ) {

		let init = {

			scale: 1

		};

		let scale;

		if ( layer.paging ) {

			scale = layer.queueLength;

		} else {

			scale = layer.width;

		}

		let end = {

			scale: scale

		};

		let variableLengthObject = ( new VariableLengthObject(

			layer.unitLength,
			layer.unitLength,
			layer.unitLength,
			layer.color,
			layer.minOpacity

		) ).getElement();

		let fmTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		fmTween.onUpdate( function() {

			variableLengthObject.scale.x = init.scale;

		} ).onStart( function() {

			layer.disposeAggregationElement();
			layer.neuralGroup.add( variableLengthObject );
			layer.isTransition = true;

		} ).onComplete( function() {

			layer.neuralGroup.remove( variableLengthObject );
			layer.initQueueElement();
			layer.initCloseButton();

			if ( layer.paging ) {

				layer.showPaginationButton();

			}

			layer.isTransition = false;
			layer.isWaitOpen = false;
			layer.isOpen = true;

		} );

		fmTween.start();

		layer.isWaitOpen = true;

	}

	function closeLayer( layer ) {

		let init = {

			scale: 1

		};

		let scale;

		if ( layer.paging ) {

			scale = layer.queueLength;

		} else {

			scale = layer.width;

		}

		let end = {

			scale: 1 / scale

		};

		let variableLength;

		if ( layer.paging ) {

			variableLength = layer.queueLength;

		} else {

			variableLength = layer.width;

		}

		let variableLengthObject = ( new VariableLengthObject(

			variableLength * layer.unitLength,
			layer.unitLength,
			layer.unitLength,
			layer.color,
			layer.minOpacity

		) ).getElement();

		let fmTween = new TWEEN.Tween( init )
			.to( end, layer.openTime );

		fmTween.onUpdate( function() {

			variableLengthObject.scale.x = init.scale;

		} ).onStart( function() {

			layer.disposeQueueElement();
			layer.neuralGroup.add( variableLengthObject );
			layer.disposeCloseButton();

			if ( layer.paging ) {

				layer.hidePaginationButton();

			}

			layer.isTransition = true;

		} ).onComplete( function() {

			layer.neuralGroup.remove( variableLengthObject );
			layer.initAggregationElement();

			layer.isTransition = false;
			layer.isWaitClose = false;
			layer.isOpen = false;

		} );

		fmTween.start();

		layer.isWaitClose = true;

	}

	return {

		openLayer: openLayer,

		closeLayer: closeLayer

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

function QueueSegment( segmentLength, segmentIndex, totalLength, unitLength, color, minOpacity, overview ) {

	this.segmentLength = segmentLength;
	this.segmentIndex = segmentIndex;
	this.totalLength = totalLength;
	this.unitLength = unitLength;
	this.color = color;
	this.minOpacity = minOpacity;
	this.overview = overview;

	this.sideOpacity = SideFaceRatio * minOpacity;

	this.totalSegments = Math.ceil( this.totalLength / this.segmentLength );

	this.queueLength = this.calcQueueLength();
	this.actualWidth = this.queueLength * this.unitLength;

	this.startIndex = undefined;
	this.endIndex = undefined;

	this.setRange();

	this.dataArray = undefined;
	this.backDataArray = undefined;
	this.dataTexture = undefined;
	this.backDataTexture = undefined;
	this.queue = undefined;

	this.queueGroup = undefined;

	this.font = TextFont;
	this.textSize = TextHelper.calcQueueTextSize( this.unitLength );
	this.indexSize = 0.5 * this.textSize;

	this.textRotation = this.overview ? - Math.PI / 2 : 0;

	this.lengthText = undefined;
	this.startText = undefined;
	this.endText = undefined;

	this.layerIndex = undefined;

	this.queueLengthNeedsUpdate = false;
	this.isLengthChanged = false;

	this.init();

}

QueueSegment.prototype = {

	init: function() {

		this.queue = this.createQueueElement();

		let queueGroup = new THREE.Object3D();
		queueGroup.add( this.queue );
		this.queueGroup = queueGroup;

	},

	createQueueElement: function() {

		let data = new Uint8Array( this.queueLength );
		this.dataArray = data;
		let backData = new Uint8Array( this.queueLength );
		this.backDataArray = backData;

		for ( let i = 0; i < this.queueLength; i++ ) {

			data[ i ] = 255 * this.minOpacity;

		}

		let dataTex = new THREE.DataTexture( data, this.queueLength, 1, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let backDataTex = new THREE.DataTexture( backData, this.queueLength, 1, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.backDataTexture = backDataTex;

		backDataTex.magFilter = THREE.NearestFilter;
		backDataTex.needsUpdate = true;

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.unitLength );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let backMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: backDataTex,
			transparent: true

		} );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			transparent: true,
			opacity: this.sideOpacity

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			material,
			backMaterial

		];

		let cube = new THREE.Mesh( boxGeometry, materials );

		cube.position.set( 0, 0, 0 );
		cube.elementType = "featureLine";
		cube.hoverable = true;

		return cube;

	},

	getElement: function() {

		return this.queueGroup;

	},

	updateVis: function( colors ) {

		let backColors = RenderPreprocessor.preProcessQueueBackColor( colors );

		for ( let i = 0; i < colors.length; i++ ) {

			this.dataArray[ i ] = 255 * colors[ i ];
			this.backDataArray[ i ] = 255 * backColors[ i ];

		}

		this.dataTexture.needsUpdate = true;
		this.backDataTexture.needsUpdate = true;

	},

	clear: function() {

		let zeroData = new Uint8Array( this.queueLength );
		let colors = ColorUtils.getAdjustValues( zeroData, this.minOpacity );

		this.updateVis( colors );

	},

	setLayerIndex: function( layerIndex ) {

		this.layerIndex = layerIndex;
		this.queue.layerIndex = layerIndex;

	},

	showText: function() {

		// create length text and add it to group

		let lengthTextContent = this.totalLength.toString();

		let geometry = new THREE.TextGeometry( lengthTextContent, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let text = new THREE.Mesh( geometry, material );

		text.rotateX( this.textRotation );

		let textPos = TextHelper.calcQueueTextPos(

			lengthTextContent.length,
			this.textSize,
			this.unitLength,
			{

				x: this.queue.position.x,
				y: this.queue.position.y,
				z: this.queue.position.z

			}

		);

		text.position.set(

			textPos.x,
			textPos.y,
			textPos.z

		);

		this.lengthText = text;

		this.queueGroup.add( this.lengthText );

		// create start index and add it to group

		let startTextContent = this.startIndex.toString();

		let startGeometry = new THREE.TextGeometry( startTextContent, {

			font: this.font,
			size: this.indexSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let startMaterial = new THREE.MeshBasicMaterial( { color: this.color } );

		let startText = new THREE.Mesh( startGeometry, startMaterial );

		startText.rotateX( this.textRotation );

		let startTextPos = TextHelper.calcSegmentStartIndexPos(

			this.actualWidth,
			startTextContent.length,
			this.indexSize,
			{

				x: this.queue.position.x,
				y: this.queue.position.y,
				z: this.queue.position.z

			}

		);

		startText.position.set(

			startTextPos.x,
			startTextPos.y,
			startTextPos.z

		);

		this.startText = startText;

		this.queueGroup.add( this.startText );

		// create end text and add it to group

		let endTextContent = this.endIndex.toString();

		let endGeometry = new THREE.TextGeometry( endTextContent, {

			font: this.font,
			size: this.indexSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let endMaterial = new THREE.MeshBasicMaterial( { color: this.color } );

		let endText = new THREE.Mesh( endGeometry, endMaterial );

		endText.rotateX( this.textRotation );

		let endTextPos = TextHelper.calcSegmentEndIndexPos(

			this.actualWidth,
			endTextContent.length,
			this.indexSize,
			{

				x: this.queue.position.x,
				y: this.queue.position.y,
				z: this.queue.position.z

			}

		);

		endText.position.set(

			endTextPos.x,
			endTextPos.y,
			endTextPos.z

		);

		this.endText = endText;

		this.queueGroup.add( this.endText );

		this.isTextShown = true;

	},

	hideText: function() {

		this.queueGroup.remove( this.lengthText );
		this.lengthText = undefined;

		this.queueGroup.remove( this.startText );
		this.startText = undefined;

		this.queueGroup.remove( this.endText );
		this.endText = undefined;

		this.isTextShown = false;

	},

	updateSegmentIndex: function( segmentIndex ) {

		if (

			this.totalSegments * this.segmentLength !== this.totalLength &&
			(

				( this.segmentIndex !== this.totalSegments - 1 && segmentIndex === this.totalSegments - 1 ) ||
				( this.segmentIndex === this.totalSegments - 1 && segmentIndex !== this.totalSegments - 1 )

			)

		) {

			this.queueLengthNeedsUpdate = true;
			this.isLengthChanged = true;

		} else {

			this.isLengthChanged = false;

		}

		this.segmentIndex = segmentIndex;

		this.setRange();

		if ( this.queueLengthNeedsUpdate ) {

			this.updateLength();

		}

	},

	setRange: function() {

		this.startIndex = this.segmentLength * this.segmentIndex + 1;
		this.endIndex = Math.min( this.totalLength, this.segmentLength * ( this.segmentIndex + 1 ) );

	},

	calcQueueLength: function() {

		return Math.min( this.totalLength, this.segmentLength * ( this.segmentIndex + 1 ) ) - this.segmentLength * this.segmentIndex;

	},

	updateLength: function() {

		this.queueLength = this.calcQueueLength();
		this.actualWidth = this.unitLength * this.queueLength;

		this.queueGroup.remove( this.queue );
		this.queue = this.createQueueElement();
		this.queue.layerIndex = this.layerIndex;
		this.queueGroup.add( this.queue );

		this.queueLengthNeedsUpdate = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * NativeLayer1d, abstract layer, can not be initialized by TensorSpace user.
 * Base class for Dense, Flatten, Activation1d, BasicLayer1d.
 * The characteristic for classes which inherit from NativeLayer1d is that their output shape has one dimension, for example, [units].
 *
 * @param config, user's configuration for NativeLayer1d.
 * @constructor
 */

function NativeLayer1d(config ) {

	// NativeLayer1d inherits from abstract layer "NativeLayer".

	NativeLayer.call( this, config );

	/**
	 * NativeLayer1d has one output dimensions: [ width ].
	 *
	 * @type { int }
	 */

	this.width = undefined;

	/**
	 * queue element's handler.
	 * queue is an element which is displayed on the screen when layer1d is open.
	 *
	 * @type { Object }
	 */

	this.queueHandler = undefined;

	/**
	 * Decide how to display hint text.
	 *
	 * @type { boolean }
	 */

	this.overview = false;

	/**
	 * mode for how to display queue element
	 * If queue element is too long, use "paging" mode may have better visualization effect.
	 *
	 * @type { boolean }
	 */

	this.paging = false;

	/**
	 * Only take effect when this.paging = true.
	 * Segment length for "one page".
	 * Default to 200.
	 *
	 * @type { number }
	 */

	this.segmentLength = 200;

	/**
	 * Only take effect when this.paging = true.
	 * Which page NativeLayer1d displays now.
	 * Can be update when "last" or "next" buttons are clicked, initial value can be defined by user.
	 * Default to 0.
	 *
	 * @type { number }
	 */

	this.segmentIndex = 0;

	/**
	 * Only take effect when this.paging = true.
	 * How many pages in NativeLayer1d.
	 *
	 * @type { number }
	 */

	this.totalSegments = undefined;

	/**
	 * Only take effect when this.paging = true.
	 * Store handler for last button.
	 *
	 * @type { Object }
	 */

	this.lastButtonHandler = undefined;

	/**
	 * Only take effect when this.paging = true.
	 * Store handler for next button.
	 *
	 * @type { Object }
	 */

	this.nextButtonHandler = undefined;

	/**
	 * Only take effect when this.paging = true.
	 * Attribute used by tween in QueueTransitionFactory.
	 *
	 * @type { number }
	 */

	this.queueLength = this.segmentLength;

	/**
	 * aggregation's width and height.
	 * aggregation is an element which is displayed on the screen when layer1d is closed.
	 *
	 * @type { number }
	 */

	this.aggregationWidth = undefined;
	this.aggregationHeight = undefined;

	/**
	 * An indicator whether layer1d is in an transition status.
	 * NativeLayer1d has a transition period between "close" and "open" when openLayer is called.
	 *
	 * @type { boolean }
	 */

	this.isTransition = false;

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * False means that user need to add value for NativeLayer1d when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	// Load user's layer1d config into some layer1d's attribute.

	this.loadLayer1dConfig( config );

	this.layerDimension = 1;

}

NativeLayer1d.prototype = Object.assign( Object.create( NativeLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer's abstract method
	 *
	 * NativeLayer1d overrides NativeLayer's function:
	 * init, updateValue, clear, handleClick, handleHoverIn, handleHoverOut,
	 * calcCloseButtonSize, calcCloseButtonPos, provideRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in NativeLayer1d, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to NativeLayer1d when call init() to initialize NativeLayer1d.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function(center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in NativeLayer1d.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		if ( this.isOpen ) {

			// Init queue element, when layer is open.

			this.initQueueElement();

			// Init close button.

			this.initCloseButton();

			if ( this.paging ) {

				// Init pagination button when layer is in "paging mode".

				this.showPaginationButton();

			}

		} else {

			// Init aggregation when layer is closed.

			this.initAggregationElement();

		}

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

		// Create relative line element.

		this.addLineGroup();

	},

	/**
	 * updateValue() accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

		// Store layer output value in "neuralValue" attribute, this attribute can be get by TensorSpace user.

		this.neuralValue = value;

		if ( this.isOpen ) {

			// In layer1d, only queue element's visualization is relative to neural value.

			this.updateQueueVis();

		}

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

			if ( this.isOpen ) {

				// Use queue's handler to clear queue element's visualization.

				this.queueHandler.clear();

			}

			// Clear layer data.

			this.neuralValue = undefined;

		}

	},

	/**
	 * handleClick() If clickable element in this layer is clicked, execute this handle function.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

		if ( clickedElement.elementType === "aggregationElement" ) {

			// If aggregation element is clicked, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If close button is clicked, close layer.

			this.closeLayer();

		} else if ( clickedElement.elementType === "paginationButton" ) {

			// If pagination button ("last" or "next") is clicked, update page visualization.

			this.updatePage( clickedElement.paginationType );

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If relationSystem is enabled, show relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.showLines( hoveredElement );

		}

		// If textSystem is enabled, show hint text, for example, show total neural number.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If relationSystem is enabled, hide relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.hideLines();

		}

		// If textSystem is enabled, hide hint text, for example, hide total neural number.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * calcCloseButtonSize() get close button size.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		// To make close button's size responsive, width = 50 is the boundary.

		if ( this.width > 50 ) {

			return 2 * this.unitLength;

		} else {

			return 1.1 * this.unitLength;

		}

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() get close button position.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { JSON } position, close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		let xTranslate;

		// Close button is positioned in the left of layer, different strategy if layer1d is in "paging mode"

		if ( this.paging ) {

			xTranslate = - this.queueLength * this.unitLength / 2 - 10 * this.unitLength;

		} else {

			xTranslate = - this.actualWidth / 2 - 10 * this.unitLength;

		}

		return {

			x: xTranslate,
			y: 0,
			z: 0

		};

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		// When layer1d is in transition, will not return any relative element.

		if ( !this.isTransition ) {

			if ( this.isOpen ) {

				// If layer is open, queue element is the relative element.

				relativeElements.push( this.queueHandler.getElement() );

			} else {

				// If layer is close, aggregation element is the relative element.

				relativeElements.push( this.aggregationHandler.getElement() );

			}

		}

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			return this.actualWidth / 2 - this.calcCloseButtonPos().x + this.calcCloseButtonSize();

		} else {

			return this.aggregationWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * openLayer() open NativeLayer1d, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			// QueueTransitionFactory handles actual open animation, checkout "QueueTransitionTween.js" for more information.

			QueueTransitionFactory.openLayer( this );

		}

	},

	/**
	 * closeLayer() close NativeLayer1d, switch layer status from "open" to "close".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			// QueueTransitionFactory handles actual close animation, checkout "QueueTransitionTween.js" for more information.

			QueueTransitionFactory.closeLayer( this );

		}

	},

	/**
	 * loadLayer1dConfig() Load user's common config into layer1d's attribute.
	 * Called when "NativeLayer1d" is initializing.
	 *
	 * @param { JSON } layerConfig, user's layer configuration.
	 */

	loadLayer1dConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			if ( layerConfig.paging !== undefined ) {

				this.paging = layerConfig.paging;

				// If paging mode is set, load paging parameters.

				if ( this.paging ) {

					if ( layerConfig.segmentLength !== undefined ) {

						this.segmentLength = layerConfig.segmentLength;
						this.queueLength = this.segmentLength;

					}

					if ( layerConfig.initSegmentIndex !== undefined ) {

						this.segmentIndex = layerConfig.initSegmentIndex;

					}

				}

			}

			if ( layerConfig.overview !== undefined ) {

				this.overview = layerConfig.overview;

			}

		}

	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in NativeLayer1d.
	 */

	initAggregationElement: function() {

		// QueueAggregation Object is a wrapper for aggregation element, checkout "QueueAggregation.js" for more information.

		let aggregationHandler = new QueueAggregation(

			this.aggregationWidth,
			this.aggregationHeight,
			this.unitLength,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, aggregation object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( this.aggregationHandler.getElement() );

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in NativeLayer1d.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * initQueueElement() create queue element's THREE.js Object, configure it, and add it to neuralGroup in NativeLayer1d.
	 */

	initQueueElement: function() {

		let queueHandler;

		// Create different elements in different mode.

		if ( this.paging ) {

			queueHandler = new QueueSegment(

				this.segmentLength,
				this.segmentIndex,
				this.width,
				this.unitLength,
				this.color,
				this.minOpacity,
				this.overview

			);

			this.queueLength = queueHandler.queueLength;

		} else {

			queueHandler = new NeuralQueue(

				this.width,
				this.unitLength,
				this.color,
				this.minOpacity,
				this.overview

			);

		}

		// Set layer index to queue element, queue element object can know which layer it has been positioned.

		queueHandler.setLayerIndex( this.layerIndex );

		// Store handler for queue element for latter use.

		this.queueHandler = queueHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( queueHandler.getElement() );

		// Update queue element' visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateQueueVis();

		}

	},

	/**
	 * disposeQueueElement() remove queue element from neuralGroup, clear their handlers, and dispose their THREE.js Object in NativeLayer1d.
	 */

	disposeQueueElement: function() {

		this.neuralGroup.remove( this.queueHandler.getElement() );
		this.queueHandler = undefined;

	},

	/**
	 * updateQueueVis() update queue element's visualization.
	 */

	updateQueueVis: function() {

		// Get colors to render the surface of queue element.

		let colors = ColorUtils.getAdjustValues( this.neuralValue, this.minOpacity );

		if ( this.paging ) {

			// Get part of colors to render segment.

			let segmentColors = colors.slice(

				this.segmentLength * this.segmentIndex,
				Math.min( this.segmentLength * ( this.segmentIndex + 1 ), this.width - 1 )

			);

			this.queueHandler.updateVis( segmentColors );

		} else {

			this.queueHandler.updateVis( colors );

		}

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		if ( element.elementType === "featureLine" ) {

			this.queueHandler.showText();
			this.textElementHandler = this.queueHandler;

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	},

	/**
	 * showPaginationButton() conditional add "next" button and "last" button into layer1d.
	 */

	showPaginationButton: function() {

		if ( this.segmentIndex === 0 && this.segmentIndex !== this.totalSegments - 1 ) {

			// First page only show "next" button.

			this.showNextButton();

		} else if ( this.segmentIndex !== 0 && this.segmentIndex === this.totalSegments - 1 ) {

			// last page only show "last" button.

			this.showLastButton();

		} else if ( this.segmentIndex === 0 && this.segmentIndex === this.totalSegments - 1 ) {

			// If only has one page, no button.

		} else {

			// In other situational, show two button.

			this.showNextButton();
			this.showLastButton();

		}

	},

	/**
	 * showLastButton() initialize "last" button, and add it to neuralGroup.
	 */

	showLastButton: function() {

		let lastButtonHandler = new PaginationButton(

			"last",
			this.calcPaginationButtonSize(),
			this.unitLength,
			this.calcPaginationButtonPos( "last" ),
			this.color,
			this.minOpacity

		);

		// Set layer index to "last" button, button object can know which layer it has been positioned.

		lastButtonHandler.setLayerIndex( this.layerIndex );

		this.lastButtonHandler = lastButtonHandler;
		this.neuralGroup.add( this.lastButtonHandler.getElement() );

	},

	/**
	 * showNextButton() initialize "next" button, and add it to neuralGroup.
	 */

	showNextButton: function() {

		let nextButtonHandler = new PaginationButton(

			"next",
			this.calcPaginationButtonSize(),
			this.unitLength,
			this.calcPaginationButtonPos( "next" ),
			this.color,
			this.minOpacity

		);

		// Set layer index to "next" button, button object can know which layer it has been positioned.

		nextButtonHandler.setLayerIndex( this.layerIndex );

		this.nextButtonHandler = nextButtonHandler;
		this.neuralGroup.add( this.nextButtonHandler.getElement() );

	},

	/**
	 * hidePaginationButton(), hide "last" button and "next" button.
	 */

	hidePaginationButton: function() {

		this.hideNextButton();
		this.hideLastButton();

	},

	/**
	 * hideNextButton(), hide "next" button.
	 */

	hideNextButton: function() {

		if ( this.nextButtonHandler !== undefined ) {

			this.neuralGroup.remove( this.nextButtonHandler.getElement() );
			this.nextButtonHandler = undefined;

		}

	},

	/**
	 * hideLastButton(), hide "last" button.
	 */

	hideLastButton: function() {

		if ( this.lastButtonHandler !== undefined ) {

			this.neuralGroup.remove( this.lastButtonHandler.getElement() );
			this.lastButtonHandler = undefined;

		}

	},

	/**                                                                                                                                                 y        y                        /**
	 * updatePage() execute actual page update work.
	 *
	 * @param { string } paginationType, "last" or "next".
	 */

	updatePage: function( paginationType ) {

		if ( paginationType === "next" ) {

			// "next" button is clicked.

			if ( this.segmentIndex === 0 ) {

				// First page now, click "next" button will show "last" button.

				this.showLastButton();

			}

			if ( this.segmentIndex === this.totalSegments - 2 ) {

				// Is going to the last page, the last page do not have "next" button.

				this.hideNextButton();

			}

			// Update segmentIndex.

			this.segmentIndex += 1;

		} else {

			// "last" button is clicked.

			if ( this.segmentIndex === this.totalSegments - 1 ) {

				// The Last page now, click "last" button will show "next" button.

				this.showNextButton();

			}

			if ( this.segmentIndex === 1 ) {

				// Is going to the first page, the first page do not have "last" button.

				this.hideLastButton();

			}

			// Update segmentIndex.

			this.segmentIndex -= 1;

		}

		// Modify segment element based on new segment index.

		this.queueHandler.updateSegmentIndex( this.segmentIndex );

		// Check whether queue length change, situation: the page's length may different with previous page.

		if ( this.queueHandler.isLengthChanged ) {

			this.queueLength = this.queueHandler.queueLength;

			if ( this.nextButtonHandler !== undefined ) {

				let nextButtonPos = this.calcPaginationButtonPos( "next" );
				this.nextButtonHandler.updatePos( nextButtonPos );

			}

			if ( this.lastButtonHandler !== undefined ) {

				let lastButtonPos = this.calcPaginationButtonPos( "last" );
				this.lastButtonHandler.updatePos( lastButtonPos );

			}

			let closeButtonPos = this.calcCloseButtonPos();
			this.closeButtonHandler.updatePos( closeButtonPos );

		}

		if ( this.neuralValue !== undefined ) {

			this.updateQueueVis();

		}

	},

	/**
	 * calcPaginationButtonSize() calculate button size.
	 *
	 * @return { number } size, pagination button size
	 */

	calcPaginationButtonSize: function() {

		// The size of pagination button is the same as close button in NativeLayer1d.

		return this.calcCloseButtonSize();

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() calculate the position of pagination button based on button type.
	 *
	 * @param { string } paginationType, "last" or "next".
	 * @return { Object } pagination button position, { x: double, y: double, z: double }, relative to layer.
	 */

	calcPaginationButtonPos: function( paginationType ) {

		if ( paginationType === "last" ) {

			// "last" button is positioned in the left of the layer.

			return {

				x: - this.queueLength * this.unitLength / 2 - 5 * this.unitLength,
				y: 0,
				z: 0

			};

		} else {

			// "next" button is positioned in the right of the layer.

			return {

				x: this.queueLength * this.unitLength / 2 + 5 * this.unitLength,
				y: 0,
				z: 0

			};

		}

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for NativeLayer1d.
	 * SubClasses ( specific layers ) override these abstract method to get NativeLayer1d's characters.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() abstract method
	 * Load layer's configuration into layer which extends NativeLayer1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig and loadLayer1dConfig.
	 *
	 * Override this function if there are some specific configuration for layer which extends NativeLayer1d.
	 *
	 * @param { JSON } layerConfig, user's configuration for layer.
	 */

	loadLayerConfig: function( layerConfig ) {

	},

	/**
	 * loadModelConfig() abstract method
	 * Load model's configuration into layer object.
	 *
	 * Override this function if there are some specific model configurations for layer.
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model.
	 */

	loadModelConfig: function( modelConfig ) {

	},

	/**
	 * assemble() abstract method
	 * Configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * Override this function to get information from previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model.
	 */

	assemble: function( layerIndex ) {

	},

	/**
	 * getRelativeElements() abstract method
	 * Get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Override this function to define relative element from previous layer.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		return [];

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Flattens the input.
 *
 * @param config, user's configuration for Flatten layer
 * @constructor
 */

function Flatten( config ) {

	// "Flatten" inherits from abstract layer "NativeLayer1d".

	NativeLayer1d.call( this, config );

	// Load user's Flatten configuration.

	this.loadLayerConfig( config );

	this.layerType = "Flatten";

}

Flatten.prototype = Object.assign( Object.create( NativeLayer1d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer1d's abstract method
	 *
	 * Dense overrides NativeLayer1d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		let units = 1;

		// Calculate output length.

		for ( let i = 0; i < this.lastLayer.outputShape.length; i++ ) {

			units *= this.lastLayer.outputShape[ i ];

		}

		this.width = units;

		if ( this.paging ) {

			this.totalSegments = Math.ceil( this.width / this.segmentLength );

		}

		// Flatten layer's outputShape has one dimension, that's why Flatten layer inherits from abstract layer "NativeLayer1d".

		this.outputShape = [ this.width ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate aggregation actual size.

		if ( this.lastLayer.layerDimension === 1 ) {

			if ( this.lastLayer.layerType === "Input1d" ) {

				this.aggregationWidth = 3 * this.unitLength;
				this.aggregationHeight = 3 * this.unitLength;

			} else {

				this.aggregationWidth = this.lastLayer.aggregationWidth;
				this.aggregationHeight = this.lastLayer.aggregationHeight;

			}

		} else {

			this.aggregationWidth = this.lastLayer.actualWidth;
			this.aggregationHeight = this.lastLayer.actualHeight;

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Dense object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.flatten;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "featureLine" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer1d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Dense.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Dense.
	 */

	loadLayerConfig: function( layerConfig ) {

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 1D pooling.
 *
 * @param config, user's configuration for Pooling1d layer
 * @constructor
 */

function Pooling1d( config ) {

	// "Pooling1d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	/**
	 * Size of the window to pool over.
	 *
	 * @type { int }
	 */

	this.poolSize = undefined;

	/**
	 * Period at which to sample the pooled values.
	 *
	 * @type { int }
	 */

	this.strides = undefined;

	/**
	 * Padding mode.
	 * "valid" or "same", default to "valid".
	 *
	 * @type { string }
	 */

	this.padding = "valid";

	/**
	 * Whether user directly define the layer shape.
	 * Set "true" if Pooling1d's shape is predefined by user.
	 *
	 * @type { boolean }
	 */

	this.isShapePredefined = false;

	// Load user's Pooling1d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Pooling1d";

}

Pooling1d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * Pooling1d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		//  If user's do not define a specific shape for layer, infer layer output shape from input shape and config.

		if ( !this.isShapePredefined ) {

			if ( this.padding === "valid" ) {

				// ceil[ ( W - F + 1 ) / S ]

				this.width = Math.ceil( ( this.inputShape[ 0 ] - this.poolSize + 1 ) / this.strides );

			} else if ( this.padding === "same" ) {

				// ceil( W / S )

				this.width = Math.ceil( this.inputShape[ 0 ] / this.strides );

			}

		}

		this.depth = this.inputShape[ 1 ];

		// Pooling1d layer's outputShape has two dimension, that's why Pooling1d layer inherits from abstract layer "NativeLayer2d".

		this.outputShape = [ this.width, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate the grid line centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeCenterList.push( closeCenter );

			// Pooling1d's grid lines align to last layer.

			let openCenter = {

				x: this.lastLayer.openCenterList[ i ].x,
				y: this.lastLayer.openCenterList[ i ].y,
				z: this.lastLayer.openCenterList[ i ].z

			};

			this.openCenterList.push( openCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Pooling1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.pooling1d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "gridLine" ) {

			// Get element which has the same index.

			let gridIndex = selectedElement.gridIndex;

			let request = {

				index: gridIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Pooling1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Pooling1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "poolSize" configuration is required.

			if ( layerConfig.poolSize !== undefined ) {

				this.poolSize = layerConfig.poolSize;

			} else {

				console.error( "\"poolSize\" property is required for pooling1d layer." );

			}

			// "strides" configuration is required.

			if ( layerConfig.strides !== undefined ) {

				this.strides = layerConfig.strides;

			} else {

				console.error( "\"strides\" property is required for pooling1d layer." );

			}

			// Load padding mode, accept two mode: "valid" and "same", support both uppercase and lowercase.

			if ( layerConfig.padding !== undefined ) {

				if ( layerConfig.padding === "valid" ) {

					this.padding = "valid";

				} else if ( layerConfig.padding === "same" ) {

					this.padding = "same";

				} else {

					console.error( "\"padding\" property do not support for " + layerConfig.padding + ", use \"valid\" or \"same\" instead." );

				}

			}

			// Load user's predefined 2d shape.

			if ( layerConfig.shape !== undefined ) {

				this.isShapePredefined = true;
				this.width = layerConfig.shape[ 0 ];

			}

		} else {

			console.error( "Lack config for Pooling1d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 2D pooling.
 *
 * @param config, user's configuration for Pooling2d layer
 * @constructor
 */

function Pooling2d( config ) {

	// "Pooling2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * Factors by which to downscale in each dimension.
	 * For example: [2, 3], 2 for width, 3 for height.
	 *
	 * @type { Array }
	 */

	this.poolSize = undefined;

	/**
	 * The size of the stride in each dimension of the pooling window.
	 * For example: [2, 2]
	 *
	 * @type { Array }
	 */

	this.strides = undefined;

	/**
	 * Padding mode.
	 * "valid" or "same", default to "valid".
	 *
	 * @type { string }
	 */

	this.padding = "valid";

	/**
	 * Whether user directly define the layer shape.
	 * Set "true" if Pooling2d's shape is predefined by user.
	 *
	 * @type { boolean }
	 */

	this.isShapePredefined = false;

	// Load user's Pooling2d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Pooling2d";

}

Pooling2d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * Pooling2d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.depth = this.lastLayer.depth;

		this.inputShape = this.lastLayer.outputShape;

		// If user's do not define a specific 2d shape for feature map, infer layer output shape from input shape and config.

		if ( !this.isShapePredefined ) {

			if ( this.padding === "valid" ) {

				// ceil[ ( W - F + 1 ) / S ]

				this.width = Math.ceil( ( this.inputShape[ 0 ] - this.poolSize[ 0 ] + 1 ) / this.strides[ 0 ] );
				this.height = Math.ceil( ( this.inputShape[ 1 ] - this.poolSize[ 1 ] + 1 ) / this.strides[ 1 ] );

			} else if ( this.padding === "same" ) {

				// ceil( W / S )

				this.width = Math.ceil( this.inputShape[ 0 ] / this.strides[ 0 ] );
				this.height = Math.ceil( this.inputShape[ 1 ] / this.strides[ 1 ] );

			}

		}

		// Pooling2d layer's outputShape has three dimension, that's why Pooling2d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let center = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( center );

			// Pooling2d's feature maps align to last layer.

			let fmCenter = {

				x: this.lastLayer.openFmCenters[ i ].x,
				y: this.lastLayer.openFmCenters[ i ].y,
				z: this.lastLayer.openFmCenters[ i ].z

			};

			this.openFmCenters.push( fmCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Pooling2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.pooling2d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "featureMap" ) {

			// Get element which has the same index.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Pooling2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Pooling2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "poolSize" configuration is required.

			if ( layerConfig.poolSize !== undefined ) {

				this.poolSize = layerConfig.poolSize;

			} else {

				console.error( "\"poolSize\" is required for Pooling2d layer" );

			}

			// "strides" configuration is required.

			if ( layerConfig.strides !== undefined ) {

				this.strides = layerConfig.strides;

			} else {

				console.error( "\"strides\" is required for Pooling2d layer" );

			}

			// Load user's predefined 2d shape.

			if ( layerConfig.shape !== undefined ) {

				this.isShapePredefined = true;
				this.width = layerConfig.shape[ 0 ];
				this.height = layerConfig.shape[ 1 ];

			}

			// Load padding mode, accept two mode: "valid" and "same", support both uppercase and lowercase.

			if ( layerConfig.padding !== undefined ) {

				if ( layerConfig.padding.toLowerCase() === "valid" ) {

					this.padding = "valid";

				} else if ( layerConfig.padding.toLowerCase() === "same" ) {

					this.padding = "same";

				} else {

					console.error( "\"padding\" property do not support for " + layerConfig.padding + ", use \"valid\" or \"same\" instead." );

				}

			}

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Reshape an input to a certain 1d shape.
 *
 * @param config, user's configuration for Reshape1d layer
 * @constructor
 */

function Reshape1d( config ) {

	// "Reshape1d" inherits from abstract layer "NativeLayer1d".

	NativeLayer1d.call( this, config );

	/**
	 * Certain 1d shape the input will be reshape into.
	 * For example: [ 3 ]
	 *
	 * @type { Array }
	 */

	this.targetShape = undefined;

	/**
	 * Total Neural number in layer, calculated in assemble period based on input shape.
	 * Set init size to be 1.
	 *
	 * @type { int }
	 */

	this.totalSize = 1;

	// Load user's Reshape configuration.

	this.loadLayerConfig( config );

	this.layerType = "Reshape1d";

}

Reshape1d.prototype = Object.assign( Object.create( NativeLayer1d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer1d's abstract method
	 *
	 * Reshape1d overrides NativeLayer1d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer and user's configuration.

		for ( let i = 0; i < this.inputShape.length; i ++ ) {

			this.totalSize *= this.inputShape[ i ];

		}

		// Check whether the input shape can be reshape into target shape.

		if ( this.totalSize !== this.width ) {

			console.error( "input size " + this.totalSize + " can not be reshape to [" + this.width + "]" );

		}

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate aggregation actual size.

		if ( this.lastLayer.layerDimension === 1 ) {

			if ( this.lastLayer.layerType === "Input1d" ) {

				this.aggregationWidth = 3 * this.unitLength;
				this.aggregationHeight = 3 * this.unitLength;

			} else {

				this.aggregationWidth = this.lastLayer.aggregationWidth;
				this.aggregationHeight = this.lastLayer.aggregationHeight;

			}

		} else {

			this.aggregationWidth = this.lastLayer.actualWidth;
			this.aggregationHeight = this.lastLayer.actualHeight;

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Reshape1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.reshape;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "featureLine" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer1d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Reshape1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Reshape1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "targetShape" configuration is required.

			if ( layerConfig.targetShape !== undefined ) {

				this.targetShape = layerConfig.targetShape;
				this.width = layerConfig.targetShape[ 0 ];

				// Reshape1d layer's outputShape has one dimension, that's why Reshape1d layer inherits from abstract layer "NativeLayer1d".

				this.outputShape = [ this.width ];

			} else {

				console.error( "\"targetShape\" property is required for reshape layer" );

			}

		} else {

			console.error( "\"Lack config for reshape layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Reshape an input to a certain 2d shape.
 *
 * @param config, user's configuration for Reshape2d layer
 * @constructor
 */

function Reshape2d( config ) {

	// "Reshape2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer2d.call( this, config );

	/**
	 * Certain 2d shape the input will be reshape into.
	 * For example: [ 3, 3 ]
	 *
	 * @type { Array }
	 */

	this.targetShape = undefined;

	/**
	 * Total Neural number in layer, calculated in assemble period based on input shape.
	 * Set init size to be 1.
	 *
	 * @type { int }
	 */

	this.totalSize = 1;

	// Load user's Reshape configuration.

	this.loadLayerConfig( config );

	this.layerType = "Reshape2d";

}

Reshape2d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * Reshape2d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer and user's configuration.

		for ( let i = 0; i < this.inputShape.length; i ++ ) {

			this.totalSize *= this.inputShape[ i ];

		}

		// Check whether the input shape can be reshape into target shape.

		if ( this.totalSize !== this.width * this.depth ) {

			console.error( "input size " + this.totalSize + " can not be reshape to [" + this.width + ", " + this.depth + "]" );

		}

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate the grid line centers for close status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeCenterList.push( closeCenter );

		}

		// Calculate the grid line centers for open status.

		this.openCenterList = QueueCenterGenerator.getCenterList( this.actualWidth, this.depth );

	},

	/**
	 * loadModelConfig() load model's configuration into Reshape2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.reshape;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "gridLine" ) {

			// As reshape layer's feature map number is different with last layer, will not show relation lines

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Reshape2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Reshape2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "targetShape" configuration is required.

			if ( layerConfig.targetShape !== undefined ) {

				this.targetShape = layerConfig.targetShape;
				this.width = layerConfig.targetShape[ 0 ];
				this.depth = layerConfig.targetShape[ 1 ];

				// Reshape2d layer's outputShape has two dimension, that's why Reshape2d layer inherits from abstract layer "NativeLayer2d".

				this.outputShape = [ this.width, this.depth ];

			} else {

				console.error( "\"targetShape\" property is required for reshape layer" );

			}

		} else {

			console.error( "\"Lack config for reshape layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Reshape an input to a certain 3d shape.
 *
 * @param config, user's configuration for Reshape3d layer
 * @constructor
 */


function Reshape3d( config ) {

	// "Reshape3d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * Certain 3d shape the input will be reshape into.
	 * For example: [ 7, 7, 32 ]
	 *
	 * @type { Array }
	 */

	this.targetShape = undefined;

	/**
	 * Total Neural number in layer, calculated in assemble period based on input shape.
	 * Set init size to be 1.
	 *
	 * @type { int }
	 */

	this.totalSize = 1;

	// Load user's Reshape configuration.

	this.loadLayerConfig( config );

	this.layerType = "Reshape3d";

}

Reshape3d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * Reshape3d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer and user's configuration.

		for ( let i = 0; i < this.inputShape.length; i ++ ) {

			this.totalSize *= this.inputShape[ i ];

		}

		// Check whether the input shape can be reshape into target shape.

		if  ( this.totalSize !== this.width * this.height * this.depth ) {

			console.error( "Input size " + this.totalSize + " can not be reshape to [" + this.width + ", " + this.height + ", " + this.depth + "]" );

		}

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for close status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeFmCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( closeFmCenter );
		}

		// Calculate the feature map centers for open status.

		this.openFmCenters = FmCenterGenerator.getFmCenters(

			this.layerShape,
			this.depth,
			this.actualWidth,
			this.actualHeight

		);

	},

	/**
	 * loadModelConfig() load model's configuration into Reshape3d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.reshape;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "featureMap" ) {

			// As reshape layer's feature map number is different with last layer, will not show relation lines.

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Reshape3d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Reshape3d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "targetShape" configuration is required.

			if ( layerConfig.targetShape !== undefined ) {

				this.targetShape = layerConfig.targetShape;
				this.width = layerConfig.targetShape[ 0 ];
				this.height = layerConfig.targetShape[ 1 ];
				this.depth = layerConfig.targetShape[ 2 ];

				// Reshape3d layer's outputShape has three dimension, that's why Reshape3d layer inherits from abstract layer "NativeLayer3d".

				this.outputShape = [ this.width, this.height, this.depth ];

			} else {

				console.error( "\"targetShape\" property is required for reshape layer" );

			}

		} else {

			console.error( "\"Lack config for reshape layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Create actual reshape layer based on user's targetShape dimension.
 *
 * @param config, user's configuration for Reshape layer
 * @returns { Layer }, actual Reshape Layer, Reshape1d or Reshape2d
 * @constructor
 */

function Reshape( config ) {

	return this.proxy( config );

}

Reshape.prototype = {

	proxy: function( config ) {

		// Check and create Reshape layer.

		if ( config !== undefined && config.targetShape !== undefined ) {

			if ( config.targetShape.length === 1 ) {

				// If targetShape dimension is 1, create Reshape1d.

				return new Reshape1d( config );

			} else if ( config.targetShape.length === 2 ) {

				// If targetShape dimension is 2, create Reshape2d.

				return new Reshape2d( config );

			} else if ( config.targetShape.length === 3 ) {

				// If targetShape dimension is 3, create Reshape3d.

				return new Reshape3d( config );

			} else {

				console.error( "Can not reshape with target shape dimension " + config.targetShape.length );

			}

		} else {

			console.error( "\"targetShape\" property is required for Reshape layer." );

		}

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * A dense (fully connected) layer.
 *
 * @param config, user's configuration for Dense layer
 * @constructor
 */

function Dense( config ) {

	// "Dense" inherits from abstract layer "NativeLayer1d".

	NativeLayer1d.call( this, config );

	// Load user's Dense configuration.

	this.loadLayerConfig( config );

	this.layerType = "Dense";

}

Dense.prototype = Object.assign( Object.create( NativeLayer1d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer1d's abstract method
	 *
	 * Dense overrides NativeLayer1d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate aggregation actual size.

		if ( this.lastLayer.layerDimension === 1 ) {

			if ( this.lastLayer.layerType === "Input1d" ) {

				this.aggregationWidth = 3 * this.unitLength;
				this.aggregationHeight = 3 * this.unitLength;

			} else {

				this.aggregationWidth = this.lastLayer.aggregationWidth;
				this.aggregationHeight = this.lastLayer.aggregationHeight;

			}

		} else {

			this.aggregationWidth = this.lastLayer.actualWidth;
			this.aggregationHeight = this.lastLayer.actualHeight;

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Dense object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.dense;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "featureLine" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer1d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Dense.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Dense.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "units" configuration is required.

			if ( layerConfig.units !== undefined ) {

				this.width = layerConfig.units;

				// Dense layer's outputShape has one dimension, that's why Dense layer inherits from abstract layer "NativeLayer1d".

				this.outputShape = [ layerConfig.units ];

				if ( this.paging ) {

					this.totalSegments = Math.ceil( this.width / this.segmentLength );

				}

			} else {

				console.error( "The \"unit\" property is required for dense layer." );

			}

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Zero-padding layer for previous 1D input layer and 2D intermediate layer.
 *
 * @param config, user's configuration for Padding1d layer
 * @constructor
 */

function Padding1d( config ) {

	// "Pooling1d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	/**
	 * padding parameters.
	 *
	 * @type { int }
	 */

	this.paddingLeft = undefined;
	this.paddingRight = undefined;
	this.paddingWidth = undefined;

	/**
	 * Actual content parameters.
	 *
	 * @type { int }
	 */

	this.contentWidth = undefined;

	// Load user's Padding1d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Padding1d";

}

Padding1d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * Padding1d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer and user's configuration.

		this.contentWidth = this.inputShape[ 0 ];
		this.width = this.contentWidth + this.paddingWidth;
		this.depth = this.inputShape[ 1 ];

		// Padding1d layer's outputShape has two dimension, that's why Padding1d layer inherits from abstract layer "NativeLayer2d".

		this.outputShape = [ this.width, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate the grid line centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeCenterList.push( closeCenter );

			// Padding1d's grid lines align to last layer.

			let openCenter = {

				x: this.lastLayer.openCenterList[ i ].x,
				y: this.lastLayer.openCenterList[ i ].y,
				z: this.lastLayer.openCenterList[ i ].z

			};

			this.openCenterList.push( openCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Padding1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.padding1d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "gridLine" ) {

			// Get element which has the same index.

			let gridIndex = selectedElement.gridIndex;

			let request = {

				index: gridIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Padding1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Padding1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "padding" configuration is required.

			if ( layerConfig.padding !== undefined ) {

				// Calculate padding parameters from user's padding config.

				this.paddingLeft = layerConfig.padding;
				this.paddingRight = layerConfig.padding;
				this.paddingWidth = this.paddingLeft + this.paddingRight;

			} else {

				console.error( "\"padding\" property is required for padding layer." );

			}

		} else {

			console.error( "Lack config for padding1d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Zero-padding layer for previous 2D input layer and 3D intermediate layer.
 *
 * @param config, user's configuration for Padding2d layer
 * @constructor
 */

function Padding2d( config ) {

	// "Padding2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * padding parameters.
	 *
	 * @type { int }
	 */

	this.paddingWidth = undefined;
	this.paddingHeight = undefined;
	this.paddingLeft = undefined;
	this.paddingRight = undefined;
	this.paddingTop = undefined;
	this.paddingBottom = undefined;

	/**
	 * Actual content parameters.
	 *
	 * @type { int }
	 */

	this.contentWidth = undefined;
	this.contentHeight = undefined;

	// Load user's Padding2d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Padding2d";

}

Padding2d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * padding2d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		// Calculate layer's shape from last layer and user's configuration.

		this.contentWidth = this.lastLayer.width;
		this.contentHeight = this.lastLayer.height;
		this.depth = this.lastLayer.depth;
		this.width = this.contentWidth + this.paddingWidth;
		this.height = this.contentHeight + this.paddingHeight;

		// Padding2d layer's outputShape has three dimension, that's why Padding2d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeFmCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( closeFmCenter );

			// Padding2d's feature map align to last layer.

			let openFmCenter = {

				x: this.lastLayer.openFmCenters[ i ].x,
				y: this.lastLayer.openFmCenters[ i ].y,
				z: this.lastLayer.openFmCenters[ i ].z

			};

			this.openFmCenters.push( openFmCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Padding2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.padding2d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "featureMap" ) {

			// Get element which has the same index.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into padding2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for padding2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "padding" configuration is required.

			if ( layerConfig.padding !== undefined ) {

				// Calculate padding parameters from user's padding config.

				this.paddingTop = layerConfig.padding[ 0 ];
				this.paddingBottom = layerConfig.padding[ 0 ];
				this.paddingLeft = layerConfig.padding[ 1 ];
				this.paddingRight = layerConfig.padding[ 1 ];

				this.paddingHeight = this.paddingTop + this.paddingBottom;
				this.paddingWidth = this.paddingLeft + this.paddingRight;

			} else {

				console.error( "\"padding\" property is required for padding layer" );

			}

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 1D Upsampling layer for layer inputs.
 * Repeats the rows and columns of the data.
 *
 * @param config, user's configuration for UpSampling1d layer
 * @constructor
 */

function UpSampling1d( config ) {

	// "UpSampling1d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	/**
	 * The upsampling factors for width.
	 *
	 * @type { int }
	 */

	this.size = undefined;

	// Load user's UpSampling1d configuration.

	this.loadLayerConfig( config );

	this.layerType = "UpSampling1d";

}

UpSampling1d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * UpSampling1d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer and user's configuration.

		this.width = this.inputShape[ 0 ] * this.size;
		this.depth = this.inputShape[ 1 ];

		// UpSampling1d layer's outputShape has two dimension, that's why UpSampling1d layer inherits from abstract layer "NativeLayer2d".

		this.outputShape = [ this.width, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate the grid line centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeCenterList.push( closeCenter );

			// UpSampling1d's grid lines align to last layer.

			let openCenter = {

				x: this.lastLayer.openCenterList[ i ].x,
				y: this.lastLayer.openCenterList[ i ].y,
				z: this.lastLayer.openCenterList[ i ].z

			};

			this.openCenterList.push( openCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into UpSampling1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.upSampling1d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "gridLine" ) {

			// Get element which has the same index.

			let gridIndex = selectedElement.gridIndex;

			let request = {

				index: gridIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into UpSampling1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for UpSampling1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "size" configuration is required.

			if ( layerConfig.size !== undefined ) {

				this.size = layerConfig.size;

			} else {

				console.error( "\"size\" property is required for UpSampling1d layer." );

			}

		} else {

			console.error( "Lack config for UpSampling1d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 2D Upsampling layer for layer inputs.
 * Repeats the rows and columns of the data.
 *
 * @param config, user's configuration for UpSampling2d layer
 * @constructor
 */

function UpSampling2d( config ) {

	// "UpSampling2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * The upsampling factors for width and height.
	 * For example: [ 2, 2 ].
	 *
	 * @type { Array }
	 */

	this.size = undefined;

	/**
	 * The upsampling factors for width and height separately.
	 *
	 * @type { int }
	 */

	this.widthSize = undefined;
	this.heightSize = undefined;

	/**
	 * Whether user directly define the layer shape.
	 * Set "true" if UpSampling2d's shape is predefined by user.
	 *
	 * @type { boolean }
	 */

	this.isShapePredefined = false;

	// Load user's UpSampling2d configuration.

	this.loadLayerConfig( config );

	this.layerType = "UpSampling2d";

}

UpSampling2d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * UpSampling2d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.depth = this.lastLayer.depth;

		this.inputShape = this.lastLayer.outputShape;

		// If user's do not define a specific 2d shape for feature map, infer layer output shape from input shape and config.

		if ( !this.isShapePredefined ) {

			this.width = this.lastLayer.width * this.widthSize;
			this.height = this.lastLayer.height * this.heightSize;

		}

		// UpSampling2d layer's outputShape has three dimension, that's why UpSampling2d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the feature map centers for close status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let center = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( center );

		}

		// Calculate the feature map centers for open status.

		this.openFmCenters = FmCenterGenerator.getFmCenters(

			this.layerShape,
			this.depth,
			this.actualWidth,
			this.actualHeight

		);

	},

	/**
	 * loadModelConfig() load model's configuration into UpSampling2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.upSampling2d;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;


		} else if ( selectedElement.elementType === "featureMap" ) {

			// Get element which has the same index.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into UpSampling2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for UpSampling2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "size" configuration is required.

			if ( layerConfig.size !== undefined ) {

				this.size = layerConfig.size;
				this.widthSize = layerConfig.size[ 0 ];
				this.heightSize = layerConfig.size[ 1 ];

			} else {

				console.error( "\"size\" property is required for UpSampling layer" );

			}

			// Load user's predefined 2d shape.

			if ( layerConfig.shape !== undefined ) {

				this.isShapePredefined = true;
				this.fmShape = layerConfig.shape;
				this.width = layerConfig.shape[ 0 ];
				this.height = layerConfig.shape[ 1 ];

			}

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function GlobalPoolingElement( actualLength, initCenter, color, minOpacity ) {

	this.theoryLength = 1;
	this.actualLength = actualLength;
	this.minOpacity = minOpacity;

	this.unitLength = this.actualLength / this.theoryLength;

	this.color = color;

	this.center = {

		x: initCenter.x,
		y: initCenter.y,
		z: initCenter.z

	};

	this.font = TextFont;

	this.globalPoint = undefined;
	this.group = undefined;

	this.textSize = TextHelper.calcGlobalPoolingSize( this.unitLength );

	this.widthText = undefined;
	this.heightText = undefined;

	this.isTextShown = false;

	this.init();

}

GlobalPoolingElement.prototype = {

	init: function() {

		let geometry = new THREE.BoxBufferGeometry( this.actualLength, this.actualLength, this.actualLength );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let cube = new THREE.Mesh( geometry, material );

		cube.position.set( 0, 0, 0 );
		cube.elementType = "globalPoolingElement";
		cube.hoverable = true;

		this.globalPoint = cube;

		let edgesGeometry = new THREE.EdgesGeometry( geometry );

		let edgesLine = new THREE.LineSegments(

			edgesGeometry,
			new THREE.LineBasicMaterial( { color: FrameColor } )

		);

		let group = new THREE.Object3D();
		group.add( cube );
		group.add( edgesLine );

		group.position.set( this.center.x, this.center.y, this.center.z );

		this.group = group;

		this.clear();

	},

	getElement: function() {

		return this.group;

	},

	updateVis: function( opacity ) {

		this.globalPoint.material.opacity = opacity;
		this.globalPoint.material.needsUpdate = true;

	},

	updatePos: function( pos ) {

		this.center.x = pos.x;
		this.center.y = pos.y;
		this.center.z = pos.z;
		this.group.position.set( this.center.x, this.center.y, this.center.z );

	},

	clear: function() {

		this.updateVis( this.minOpacity );

	},

	setLayerIndex: function( layerIndex ) {

		this.globalPoint.layerIndex = layerIndex;

	},

	setFmIndex: function( fmIndex ) {

		this.globalPoint.fmIndex = fmIndex;

	},

	showText: function() {

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let widthGeometry = new THREE.TextGeometry( this.theoryLength.toString(), {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let widthText = new THREE.Mesh( widthGeometry, material );

		let widthTextPos = TextHelper.calcFmWidthTextPos(

			1,
			this.textSize,
			this.actualLength,
			{

				x: this.globalPoint.position.x,
				y: this.globalPoint.position.y,
				z: this.globalPoint.position.z

			}

		);

		widthText.position.set(

			widthTextPos.x,
			widthTextPos.y,
			widthTextPos.z

		);

		widthText.rotateX( - Math.PI / 2 );

		let heightGeometry = new THREE.TextGeometry( this.theoryLength.toString(), {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let heightText = new THREE.Mesh( heightGeometry, material );

		let heightTextPos = TextHelper.calcFmHeightTextPos(

			1,
			this.textSize,
			this.actualLength,
			{

				x: this.globalPoint.position.x,
				y: this.globalPoint.position.y,
				z: this.globalPoint.position.z

			}

		);

		heightText.position.set(

			heightTextPos.x,
			heightTextPos.y,
			heightTextPos.z

		);

		heightText.rotateX( - Math.PI / 2 );

		this.widthText = widthText;
		this.heightText = heightText;

		this.group.add( this.widthText );
		this.group.add( this.heightText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.group.remove( this.widthText );
		this.group.remove( this.heightText );
		this.widthText = undefined;
		this.heightText = undefined;

		this.isTextShown = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 1D Global pooling.
 *
 * @param config, user's configuration for GlobalPooling1d layer
 * @constructor
 */

function GlobalPooling1d( config ) {

	// "GlobalPooling1d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	/**
	 * Global pooling's width is const ( 1 ).
	 *
	 * @type { int }
	 */

	this.width = 1;

	this.layerType = "GlobalPooling1d";

}

GlobalPooling1d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * GlobalPooling1d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;
		this.depth = this.inputShape[ 1 ];

		// GlobalPooling1d layer's outputShape has two dimension, that's why GlobalPooling1d layer inherits from abstract layer "NativeLayer2d".

		this.outputShape = [ 1, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate the elements centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let closeCenter = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeCenterList.push( closeCenter );

			// GlobalPooling1d's elements align to last layer.

			let openCenter = {

				x: this.lastLayer.openCenterList[ i ].x,
				y: this.lastLayer.openCenterList[ i ].y,
				z: this.lastLayer.openCenterList[ i ].z

			};

			this.openCenterList.push( openCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into GlobalPooling1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.globalPooling1d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "globalPoolingElement" ) {

			// Get element which has the same index.

			let gridIndex = selectedElement.gridIndex;

			let request = {

				index: gridIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * As global pooling has different element compared with other 2d layer,
	 * So global pooling override NativeLayer3d's "initSegregationElements" function.
	 *
	 * @param centers
	 */

	initSegregationElements: function( centers ) {

		for ( let i = 0; i < centers.length; i ++ ) {

			// GlobalPoolingElement is a wrapper for one feature map, checkout "GlobalPoolingElement.js" for more information.

			let queueHandler = new GlobalPoolingElement(

				this.actualWidth,
				centers[ i ],
				this.color,
				this.minOpacity

			);

			// Set layer index to GlobalPoolingElement, element can know which layer it has been positioned.

			queueHandler.setLayerIndex( this.layerIndex );

			// Set element index in layer.

			queueHandler.setFmIndex( i );

			// Store handler for feature map for latter use.

			this.queueHandlers.push( queueHandler );

			// Get actual THREE.js element and add it to layer wrapper Object.

			this.neuralGroup.add( queueHandler.getElement() );

		}

		// Update all GlobalPoolingElement's visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateSegregationVis();

		}

	},

	/**
	 * As global pooling has different element compared with other 2d layer,
	 * So global pooling override NativeLayer3d's "showText" function.
	 *
	 * @param element
	 */

	showText: function( element ) {

		if ( element.elementType === "globalPoolingElement" ) {

			let fmIndex = element.fmIndex;
			this.queueHandlers[ fmIndex ].showText();
			this.textElementHandler = this.queueHandlers[ fmIndex ];

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * 2D Global pooling.
 *
 * @param config, user's configuration for GlobalPooling2d layer
 * @constructor
 */

function GlobalPooling2d( config ) {

	// "GlobalPooling2d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * Global pooling's width and height is const ( 1 ).
	 *
	 * @type { int }
	 */

	this.width = 1;
	this.height = 1;

	this.layerType = "GlobalPooling2d";

}

GlobalPooling2d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * GlobalPooling2d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.depth = this.lastLayer.depth;

		// GlobalPooling2d layer's outputShape has three dimension, that's why GlobalPooling2d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ 1, 1, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;
		this.actualHeight = this.height * this.unitLength;

		// Calculate the elements centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let center = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( center );

			// GlobalPooling2d's elements align to last layer.

			let fmCenter = {

				x: this.lastLayer.openFmCenters[ i ].x,
				y: this.lastLayer.openFmCenters[ i ].y,
				z: this.lastLayer.openFmCenters[ i ].z

			};

			this.openFmCenters.push( fmCenter );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into GlobalPooling2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.globalPooling2d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "globalPoolingElement" ) {

			// Get element which has the same index.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * As global pooling has different element compared with other 3d layer,
	 * So global pooling override NativeLayer3d's "initSegregationElements" function.
	 *
	 * @param centers
	 */

	initSegregationElements: function( centers ) {

		for ( let i = 0; i < this.depth; i ++ ) {

			// GlobalPoolingElement is a wrapper for one feature map, checkout "GlobalPoolingElement.js" for more information.

			let segregationHandler = new GlobalPoolingElement(

				this.actualWidth,
				centers[ i ],
				this.color,
				this.minOpacity

			);

			// Set layer index to GlobalPoolingElement, element can know which layer it has been positioned.

			segregationHandler.setLayerIndex( this.layerIndex );

			// Set element index in layer.

			segregationHandler.setFmIndex( i );

			// Store handler for feature map for latter use.

			this.segregationHandlers.push( segregationHandler );

			// Get actual THREE.js element and add it to layer wrapper Object.

			this.neuralGroup.add( segregationHandler.getElement() );

		}

		// Update all GlobalPoolingElement's visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateSegregationVis();

		}

	},

	/**
	 * As global pooling has different element compared with other 3d layer,
	 * So global pooling override NativeLayer3d's "showText" function.
	 *
	 * @param element
	 */

	showText: function( element ) {

		if ( element.elementType === "globalPoolingElement" ) {

			let fmIndex = element.fmIndex;
			this.segregationHandlers[ fmIndex ].showText();
			this.textElementHandler = this.segregationHandlers[ fmIndex ];

		}

	},

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * layer has 1d shape.
 *
 * @param config, user's configuration for BasicLayer1d layer
 * @constructor
 */

function BasicLayer1d( config ) {

	// "BasicLayer1d" inherits from abstract layer "NativeLayer1d".

	NativeLayer1d.call( this, config );

	// Load user's BasicLayer1d configuration.

	this.loadLayerConfig( config );

	this.layerType = "BasicLayer1d";

}

BasicLayer1d.prototype = Object.assign( Object.create( NativeLayer1d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer1d's abstract method
	 *
	 * BasicLayer1d overrides NativeLayer1d's function:
	 * assemble, loadModelConfig
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.unitLength * this.width;

		// Calculate aggregation actual size.

		if ( this.lastLayer.layerDimension === 1 ) {

			if ( this.lastLayer.layerType === "Input1d" ) {

				this.aggregationWidth = 3 * this.unitLength;
				this.aggregationHeight = 3 * this.unitLength;

			} else {

				this.aggregationWidth = this.lastLayer.aggregationWidth;
				this.aggregationHeight = this.lastLayer.aggregationHeight;

			}

		} else {

			this.aggregationWidth = this.lastLayer.actualWidth;
			this.aggregationHeight = this.lastLayer.actualHeight;

		}

	},

	/**
	 * loadModelConfig() load model's configuration into BasicLayer1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if( this.color === undefined ) {

			this.color = modelConfig.color.basicLayer1d;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer1d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into BasicLayer1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for BasicLayer1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "shape" configuration is required.

			if ( layerConfig.shape !== undefined ) {

				this.width = layerConfig.shape[ 0 ];

				// BasicLayer1d layer's outputShape has one dimension, that's why BasicLayer1d layer inherits from abstract layer "NativeLayer1d".

				this.outputShape = [ this.width ];

			} else {

				console.error( "\"shape\" property is required for NativeLayer1d." );

			}

			if ( this.paging ) {

				this.totalSegments = Math.ceil( this.width / this.segmentLength );

			}

		} else {

			console.error( "Lack config for NativeLayer1d." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * layer has 2d shape.
 *
 * @param config, user's configuration for BasicLayer2d layer
 * @constructor
 */

function BasicLayer2d( config ) {

	// "BasicLayer2d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	// Load user's BasicLayer2d configuration.

	this.loadLayerConfig( config );

	this.layerType = "BasicLayer2d";

}

BasicLayer2d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * BasicLayer2d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.unitLength * this.width;

		// Calculate the grid line centers for open status.

		this.openCenterList = QueueCenterGenerator.getCenterList( this.actualWidth, this.depth );

	},

	/**
	 * loadModelConfig() load model's configuration into BasicLayer2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if( this.color === undefined ) {

			this.color = modelConfig.color.basicLayer2d;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into BasicLayer2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for BasicLayer2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "shape" configuration is required.

			if ( layerConfig.shape !== undefined ) {

				this.width = layerConfig.shape[ 0 ];
				this.depth = layerConfig.shape[ 1 ];

				// BasicLayer2d layer's outputShape has two dimension, that's why BasicLayer2d layer inherits from abstract layer "NativeLayer2d".

				this.outputShape = [ this.width, this.depth ];

				// Calculate the grid line centers for close status.

				for ( let i = 0; i < this.depth; i ++ ) {

					let center = {

						x: 0,
						y: 0,
						z: 0

					};

					this.closeCenterList.push( center );

				}

			} else {

				console.error( "\"shape\" property is required for NativeLayer2d." );

			}

		} else {

			console.error( "Lack config for NativeLayer2d." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * layer has 3d shape.
 *
 * @param config, user's configuration for BasicLayer3d layer
 * @constructor
 */

function BasicLayer3d( config ) {

	// "BasicLayer3d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	// Load user's BasicLayer3d configuration.

	this.loadLayerConfig( config );

	this.layerType = "BasicLayer3d";

}

BasicLayer3d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * BasicLayer3d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function ( layerIndex ) {

		this.layerIndex = layerIndex;

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.unitLength * this.width;
		this.actualHeight = this.unitLength * this.height;

		// Calculate the feature map centers for open status.

		this.openFmCenters = FmCenterGenerator.getFmCenters(

			this.layerShape,
			this.depth,
			this.actualWidth,
			this.actualHeight

		);

	},

	/**
	 * loadModelConfig() load model's configuration into BasicLayer3d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if( this.color === undefined ) {

			this.color = modelConfig.color.basicLayer3d;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into BasicLayer3d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for BasicLayer3d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "shape" configuration is required.

			if ( layerConfig.shape !== undefined ) {

				this.width = layerConfig.shape[ 0 ];
				this.height = layerConfig.shape[ 1 ];
				this.depth = layerConfig.shape[ 2 ];

				// BasicLayer3d layer's outputShape has three dimension, that's why BasicLayer3d layer inherits from abstract layer "NativeLayer3d".

				this.outputShape = [ this.width, this.height, this.depth ];

				// Calculate the feature map centers for close status.

				for ( let i = 0; i < this.depth; i ++ ) {

					let center = {

						x: 0,
						y: 0,
						z: 0

					};

					this.closeFmCenters.push( center );

				}

			} else {

				console.error( "\"shape\" property is required for basicLayer3d." );

			}

		} else {

			console.error( "Lack config for basicLayer3d." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Applies an activation function to an 1D output.
 *
 * @param config, user's configuration for Activation1d layer
 * @constructor
 */

function Activation1d( config ) {

	// "Activation1d" inherits from abstract layer "NativeLayer1d".

	NativeLayer1d.call( this, config );

	/**
	 * Name of the activation function to use.
	 *
	 * @type { string }
	 */

	this.activation = undefined;

	// Load user's Activation1d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Activation1d";

}

Activation1d.prototype = Object.assign( Object.create( NativeLayer1d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer1d's abstract method
	 *
	 * Activation1d overrides NativeLayer1d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		this.width = this.inputShape[ 0 ];

		if ( this.paging ) {

			this.totalSegments = Math.ceil( this.width / this.segmentLength );

		}

		// Activation1d layer's outputShape has one dimension, that's why Activation1d layer inherits from abstract layer "NativeLayer1d".

		this.outputShape = [ this.width ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth which is used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.width * this.unitLength;

		// Calculate aggregation actual size.

		if ( this.lastLayer.layerDimension === 1 ) {

			if ( this.lastLayer.layerType === "Input1d" ) {

				this.aggregationWidth = 3 * this.unitLength;
				this.aggregationHeight = 3 * this.unitLength;

			} else {

				this.aggregationWidth = this.lastLayer.aggregationWidth;
				this.aggregationHeight = this.lastLayer.aggregationHeight;

			}

		} else {

			this.aggregationWidth = this.lastLayer.actualWidth;
			this.aggregationHeight = this.lastLayer.actualHeight;

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Activation1d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.activation1d;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" || selectedElement.elementType === "featureLine" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer1d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Activation1d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Activation1d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "activation" configuration is required.

			if ( layerConfig.activation !== undefined ) {

				this.activation = layerConfig.activation;

			} else {

				console.error( "\"activation\" property is required for activation1d layer." );

			}

		} else {

			console.error( "Lack config for layer activation1d." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Applies an activation function to an 2D output.
 *
 * @param config, user's configuration for Activation2d layer
 * @constructor
 */

function Activation2d( config ) {

	// "Activation2d" inherits from abstract layer "NativeLayer2d".

	NativeLayer2d.call( this, config );

	/**
	 * Name of the activation function to use.
	 *
	 * @type { string }
	 */

	this.activation = undefined;

	// Load user's Activation2d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Activation2d";

}

Activation2d.prototype = Object.assign( Object.create( NativeLayer2d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer2d's abstract method
	 *
	 * Activation2d overrides NativeLayer2d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer.

		this.width = this.inputShape[ 0 ];
		this.depth = this.inputShape[ 1 ];

		// Activation2d layer's outputShape has two dimension, that's why Activation2d layer inherits from abstract layer "NativeLayer2d".

		this.outputShape = [ this.width, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.unitLength * this.width;

		// Calculate the grid line centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			this.closeCenterList.push( {

				x: 0,
				y: 0,
				z: 0

			} );

			// Activation2d's grid lines align to last layer.

			this.openCenterList.push( {

				x: this.lastLayer.openCenterList[ i ].x,
				y: this.lastLayer.openCenterList[ i ].y,
				z: this.lastLayer.openCenterList[ i ].z

			} );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Activation2d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.activation2d;

		}

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "featureMap" ) {

			// Get element which has the same index.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer2d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Activation2d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Activation2d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "activation" configuration is required.

			if ( layerConfig.activation !== undefined ) {

				this.activation = layerConfig.activation;

			} else {

				console.error( "\"activation\" property is required for activation1d layer." );

			}

		} else {

			console.error( "Lack config for activation2d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Applies an activation function to an 3D output.
 *
 * @param config, user's configuration for Activation3d layer
 * @constructor
 */

function Activation3d( config ) {

	// "Activation3d" inherits from abstract layer "NativeLayer3d".

	NativeLayer3d.call( this, config );

	/**
	 * Name of the activation function to use.
	 *
	 * @type { string }
	 */

	this.activation = undefined;

	// Load user's Activation3d configuration.

	this.loadLayerConfig( config );

	this.layerType = "Activation3d";

}

Activation3d.prototype = Object.assign( Object.create( NativeLayer3d.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class NativeLayer3d's abstract method
	 *
	 * Activation3d overrides NativeLayer3d's function:
	 * assemble, loadModelConfig, getRelativeElements
	 *
	 * ============
	 */

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		this.inputShape = this.lastLayer.outputShape;

		// Calculate layer's shape from last layer.

		this.width = this.inputShape[ 0 ];
		this.height = this.inputShape[ 1 ];
		this.depth = this.inputShape[ 2 ];

		// Activation3d layer's outputShape has three dimension, that's why Activation3d layer inherits from abstract layer "NativeLayer3d".

		this.outputShape = [ this.width, this.height, this.depth ];

		// Unit length is the same as last layer, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.lastLayer.unitLength;
		this.actualWidth = this.unitLength * this.width;
		this.actualHeight = this.unitLength * this.height;

		// Calculate the feature map centers for close status and open status.

		for ( let i = 0; i < this.depth; i ++ ) {

			this.closeFmCenters.push( {

				x: 0,
				y: 0,
				z: 0

			} );

			this.openFmCenters.push( {

				x: this.lastLayer.openFmCenters[ i ].x,
				y: this.lastLayer.openFmCenters[ i ].y,
				z: this.lastLayer.openFmCenters[ i ].z

			} );

		}

	},

	/**
	 * loadModelConfig() load model's configuration into Activation3d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.color === undefined ) {

			this.color = modelConfig.color.activation3d;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		let relativeElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			// "all" means get all "displayed" elements from last layer.

			let request = {

				all: true

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		} else if ( selectedElement.elementType === "featureMap" ) {

			// Get element which has the same index.

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			relativeElements = this.lastLayer.provideRelativeElements( request ).elementList;

		}

		return relativeElements;

	},

	/**
	 * ============
	 *
	 * Functions above override base class NativeLayer3d's abstract method.
	 *
	 * ============
	 */

	/**
	 * loadLayerConfig() Load user's configuration into Activation3d.
	 * The configuration load in this function sometimes has not been loaded in loadBasicLayerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration for Activation3d.
	 */

	loadLayerConfig: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// "activation" configuration is required.

			if ( layerConfig.activation !== undefined ) {

				this.activation = layerConfig.activation;

			} else {

				console.error( "\"activation\" property is required for activation3d layer." );

			}

		} else {

			console.error( "Lack config for Activation3d layer." );

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function MergedLineGroup(layer, scene, neuralGroup, color, minOpacity ) {

	this.layer = layer;
	this.scene = scene;
	this.neuralGroup = neuralGroup;
	this.color = color;
	this.minOpacity = minOpacity;

	this.straightLineGroup = undefined;
	this.curveLineGroup = undefined;

	this.init();

}

MergedLineGroup.prototype = {

	init: function() {

		let lineMat = new THREE.LineBasicMaterial( {

			opacity: this.minOpacity,
			transparent:true,
			vertexColors: THREE.VertexColors

		} );

		let straightLineGeo = new THREE.Geometry();
		straightLineGeo.dynamic = true;
		this.straightLineGroup = new THREE.Line( straightLineGeo, lineMat );

		let curveLineGeo = new THREE.Geometry();
		curveLineGeo.dynamic = true;
		this.curveLineGroup = new THREE.Line( curveLineGeo, lineMat );

	},

	getLineGroupParameters: function( selectedElement ) {

		this.scene.updateMatrixWorld();

		let straightLineColors = [];
		let straightLineVertices = [];

		let curveLineColors = [];
		let curveLineVertices = [];

		let relatedElements = this.layer.getRelativeElements( selectedElement );

		let straightElements = relatedElements.straight;
		let curveElements = relatedElements.curve;

		let neuralGroupPos = new THREE.Vector3();
		this.neuralGroup.getWorldPosition( neuralGroupPos );

		let globalStartPos = new THREE.Vector3();

		selectedElement.getWorldPosition( globalStartPos );

		let lineStartPos = globalStartPos.sub( neuralGroupPos );

		for ( let i = 0; i < straightElements.length; i ++ ) {

			straightLineColors.push( new THREE.Color( this.color ) );
			straightLineColors.push( new THREE.Color( this.color ) );

			let globalRelativePos = new THREE.Vector3();
			straightElements[ i ].getWorldPosition( globalRelativePos );

			straightLineVertices.push( globalRelativePos.sub( neuralGroupPos  ) );
			straightLineVertices.push( lineStartPos );

		}

		let forward = false;

		for ( let i = 0; i < curveElements.length; i ++ ) {

			let startPos = lineStartPos;

			let endGlobalPos = new THREE.Vector3();
			curveElements[ i ].getWorldPosition( endGlobalPos );

			let endPos = endGlobalPos.sub( neuralGroupPos );
			let startEndDistance = startPos.y - endPos.y;
			let controlTranslateXVector;

			if ( startPos.x >= 0 ) {

				controlTranslateXVector = new THREE.Vector3( this.layer.actualWidth + startEndDistance, 0, 0 );

			} else {

				controlTranslateXVector = new THREE.Vector3( - this.layer.actualWidth - startEndDistance, 0, 0 );

			}

			let firstControlPointPos = startPos.clone().add( controlTranslateXVector );
			let secondControlPointPos = endPos.clone().add( controlTranslateXVector );

			let curve = new THREE.CubicBezierCurve3(

				startPos,
				firstControlPointPos,
				secondControlPointPos,
				endPos

			);

			let points = curve.getPoints( 50 );

			if ( forward ) {

				for ( let i = 0; i < points.length; i ++ ) {

					curveLineVertices.push( points[ i ] );
					curveLineColors.push( new THREE.Color( this.color ) );

				}

			} else {

				for ( let i = points.length - 1; i >= 0; i -- ) {

					curveLineVertices.push( points[ i ] );
					curveLineColors.push( new THREE.Color( this.color ) );

				}

			}

			forward = !forward;

		}

		return {

			straight: {

				lineColors: straightLineColors,
				lineVertices: straightLineVertices

			},

			curve: {

				lineColors: curveLineColors,
				lineVertices: curveLineVertices

			}

		}

	},

	showLines: function( selectedElement ) {

		let lineGroupParameters = this.getLineGroupParameters( selectedElement );

		let straightParameters = lineGroupParameters.straight;
		let curveParameters = lineGroupParameters.curve;

		this.straightLineGroup.geometry = this.createGroupGeometry(

			straightParameters.lineVertices,
			straightParameters.lineColors

		);

		this.straightLineGroup.material.needsUpdate = true;

		this.neuralGroup.add( this.straightLineGroup );

		this.curveLineGroup.geometry = this.createGroupGeometry(

			curveParameters.lineVertices,
			curveParameters.lineColors

		);

		this.curveLineGroup.material.needsUpdate = true;

		this.neuralGroup.add( this.curveLineGroup );

	},

	hideLines: function() {

		this.straightLineGroup.geometry.dispose();
		this.neuralGroup.remove( this.straightLineGroup );

		this.curveLineGroup.geometry.dispose();
		this.neuralGroup.remove( this.curveLineGroup );

	},

	createGroupGeometry: function( lineVertices, lineColors) {

		let geometry = new THREE.Geometry( {

			transparent:true,
			opacity: this.minOpacity

		} );

		geometry.colors = lineColors;
		geometry.vertices = lineVertices;
		geometry.colorsNeedUpdate = true;
		geometry.verticesNeedUpdate = true;

		return geometry;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * MergedLayer, abstract layer, can not be initialized by TensorSpace user.
 * Base class for MergedLayer1d, MergedLayer2d, MergedLayer3d.
 * MergedLayer add merged line group character into "Layer".
 *
 * @param config, user's configuration for MergedLayer.
 * @constructor
 */

function MergedLayer( config ) {

	// NativeLayer inherits from abstract layer "Layer"

	Layer.call( this, config.userConfig );

	/**
	 * Store handler for line group.
	 *
	 * @type { Object }
	 */

	this.lineGroupHandler = undefined;

	/**
	 * Operator for merge function.
	 * Seven kinds of merge function: add, average, concatenate, dot, maximum, multiply, subtract.
	 *
	 * @type { string }
	 */

	this.operator = undefined;

	/**
	 * Identity whether the layer is merged layer.
	 * The different between native layer and merge layer is that the the merged layer's "isMerged" attribute is true.
	 *
	 * @type { boolean }
	 */

	this.isMerged = true;

	/**
	 * Elements participle in merge function.
	 *
	 * @type { Array }
	 */

	this.mergedElements = [];

}

MergedLayer.prototype = Object.assign( Object.create( Layer.prototype ), {

	/**
	 * addLineGroup() add line merged group element to layer, store its handler.
	 */

	addLineGroup: function() {

		this.lineGroupHandler = new MergedLineGroup(

			this,
			this.scene,
			this.neuralGroup,
			this.color,
			this.minOpacity

		);

	},

	/**
	 * ============
	 *
	 * Functions below are abstract method for Layer.
	 * SubClasses ( specific layers ) override these abstract method to get Layer's characters.
	 *
	 * ============
	 */

	/**
	 * init() abstract method
	 * Create actual THREE.Object in Layer, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to Layer when call init() to initialize Layer.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

	},

	/**
	 * assemble() abstract method
	 * Configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * Override this function to get information from previous layer
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

	},

	/**
	 * updateValue() abstract method
	 * Accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * Override this function to implement layer's own value update strategy.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function( value ) {

	},

	/**
	 * clear() abstract method
	 * Clear data and visualization in layer.
	 *
	 * Override this function to implement layer's own clear function.
	 */

	clear: function() {

	},

	/**
	 * handleClick() abstract method
	 * Event callback, if clickable element in this layer is clicked, execute this handle function.
	 *
	 * Override this function if layer has any clicked event.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

	},

	/**
	 * handleHoverIn() abstract method
	 * Event callback, if hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * Override this function if layer has any hover event.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

	},

	/**
	 * handleHoverOut() abstract method
	 * Event callback, called by model if mouse hover out of this layer.
	 *
	 * Override this function if layer has some hover event.
	 */

	handleHoverOut: function() {

	},

	/**
	 * loadModelConfig() abstract method
	 * Load model's configuration into layer object.
	 *
	 * Override this function if there are some specific model configurations for layer.
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

	},

	/**
	 * calcCloseButtonSize() abstract method
	 * Called by initCloseButton function in abstract class "Layer", get close button size.
	 *
	 * Override this function to implement layer's own button size calculation strategy.
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		return  1;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() abstract method
	 * Called by initCloseButton function in abstract class "Layer", get close button position.
	 *
	 * Override this function to implement layer's own button position calculation strategy.
	 *
	 * @return { Object } close button position, { x: double, y: double, z: double }, relative to layer.
	 */

	calcCloseButtonPos: function() {

		return {

			x: 0,
			y: 0,
			z: 0

		};

	},

	/**
	 * ============
	 *
	 * As native layer add basic line group element to layer,
	 * the inherited layer need to implement two more abstract class than directly implement "Layer",
	 * "getRelativeElements" and "provideRelativeElements" to enable line system.
	 *
	 * ============
	 */

	/**
	 * getRelativeElements() abstract method
	 * Get relative element in last layer for relative lines based on given hovered element.
	 * Straight elements is used to draw straight line, curve elements is used to draw Bezier curves.
	 *
	 * Override this function to define relative element from previous layer.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster
	 * @return { Object } { straight: THREE.Object[], curve: THREE.Object[] }
	 */

	getRelativeElements: function( selectedElement ) {

		return {

			straight: [],
			curve: []

		};

	},

	/**
	 * provideRelativeElements() abstract method
	 * Return relative elements.
	 *
	 * Override this function to return relative elements based on request information.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: THREE.Object[] }
	 */

	provideRelativeElements: function( request ) {

		return {

			isOpen: this.isOpen,
			elementList: []

		};

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function MergedAggregation( operator, width, height, unitLength, depth, color, minOpacity ) {

	this.operator = operator;
	this.width = width;
	this.height = height;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.width;
	this.actualHeight = this.unitLength * this.height;
	this.depth = depth;
	this.color = color;
	this.minOpacity = minOpacity;

	this.cube = undefined;
	this.aggregationElement = undefined;

	this.dataArray = undefined;
	this.dataTexture = undefined;

	this.dataMaterial = undefined;
	this.clearMaterial = undefined;

	this.init();

}

MergedAggregation.prototype = {

	init: function() {

		let amount = this.width * this.height;
		let data = new Uint8Array( amount );
		this.dataArray = data;
		let dataTex = new THREE.DataTexture( data, this.width, this.height, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let geometry = new THREE.BoxBufferGeometry( this.actualWidth, this.depth, this.actualHeight );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			opacity: this.minOpacity,
			transparent: true

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial

		];

		this.dataMaterial = materials;

		let operatorTexture = new THREE.TextureLoader().load( TextureProvider.getTexture( this.operator ) );

		let operatorMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: operatorTexture,
			transparent: true

		} );

		let clearMaterial = [

			basicMaterial,
			basicMaterial,
			operatorMaterial,
			operatorMaterial,
			basicMaterial,
			basicMaterial

		];

		this.clearMaterial = clearMaterial;

		let cube = new THREE.Mesh( geometry, materials );

		cube.position.set( 0, 0, 0 );
		cube.elementType = "aggregationElement";
		cube.clickable = true;
		cube.hoverable = true;

		this.cube = cube;

		let edgesGeometry = new THREE.EdgesGeometry( geometry );
		let edgesLine = new THREE.LineSegments(

			edgesGeometry,
			new THREE.LineBasicMaterial( { color: FrameColor } )

		);

		let aggregationGroup = new THREE.Object3D();
		aggregationGroup.add( cube );
		aggregationGroup.add( edgesLine );

		this.aggregationElement = aggregationGroup;

		this.clear();

	},

	getElement: function() {

		return this.aggregationElement;

	},

	setLayerIndex: function( layerIndex ) {

		this.cube.layerIndex = layerIndex;

	},

	clear: function() {

		let zeroValue = new Int8Array( this.width * this.height );
		let colors = ColorUtils.getAdjustValues( zeroValue, this.minOpacity );
		this.updateVis( colors );
		this.cube.material = this.clearMaterial;

	},

	updateVis: function( colors ) {

		let renderColor = RenderPreprocessor.preProcessFmColor( colors, this.width, this.height );

		for ( let i = 0; i < renderColor.length; i++ ) {

			this.dataArray[ i ] = renderColor[ i ] * 255;

		}

		this.dataTexture.needsUpdate = true;
		this.cube.material = this.dataMaterial;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function MergedFeatureMap( operator, width, height, unitLength, initCenter, color, minOpacity ) {

	this.operator = operator;
	this.fmWidth = width;
	this.fmHeight = height;
	this.unitLength = unitLength;
	this.actualWidth = this.unitLength * this.fmWidth;
	this.actualHeight = this.unitLength * this.fmHeight;
	this.color = color;
	this.minOpacity = minOpacity;
	this.sideOpacity = SideFaceRatio * this.minOpacity;

	this.neuralLength = width * height;
	this.unitLength = this.actualWidth / this.fmWidth;

	this.fmCenter = {

		x: initCenter.x,
		y: initCenter.y,
		z: initCenter.z

	};

	this.dataArray = undefined;
	this.dataTexture = undefined;
	this.featureMap = undefined;
	this.featureGroup = undefined;

	this.font = TextFont;

	this.textSize = TextHelper.calcFmTextSize( this.actualWidth );

	this.widthText = undefined;
	this.heightText = undefined;

	this.dataMaterial = undefined;
	this.clearMaterial = undefined;

	this.init();

}

MergedFeatureMap.prototype = {

	init: function() {

		let amount = this.fmWidth * this.fmHeight;
		let data = new Uint8Array( amount );
		this.dataArray = data;

		let dataTex = new THREE.DataTexture( data, this.fmWidth, this.fmHeight, THREE.LuminanceFormat, THREE.UnsignedByteType );
		this.dataTexture = dataTex;

		dataTex.magFilter = THREE.NearestFilter;
		dataTex.needsUpdate = true;

		let boxGeometry = new THREE.BoxBufferGeometry( this.actualWidth, this.unitLength, this.actualHeight );

		let material = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: dataTex,
			transparent: true

		} );

		let basicMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			transparent: true,
			opacity: this.sideOpacity

		} );

		let materials = [

			basicMaterial,
			basicMaterial,
			material,
			material,
			basicMaterial,
			basicMaterial

		];

		this.dataMaterial = materials;

		let operatorTexture = new THREE.TextureLoader().load( TextureProvider.getTexture( this.operator ) );

		let operatorMaterial = new THREE.MeshBasicMaterial( {

			color: this.color,
			alphaMap: operatorTexture,
			transparent: true

		} );

		let clearMaterial = [

			basicMaterial,
			basicMaterial,
			operatorMaterial,
			operatorMaterial,
			basicMaterial,
			basicMaterial

		];

		this.clearMaterial = clearMaterial;

		let cube = new THREE.Mesh( boxGeometry, materials );
		cube.elementType = "featureMap";
		cube.hoverable = true;

		this.featureMap = cube;

		let featureGroup = new THREE.Object3D();
		featureGroup.position.set( this.fmCenter.x, this.fmCenter.y, this.fmCenter.z );
		featureGroup.add( cube );
		this.featureGroup = featureGroup;

		this.clear();

	},

	getElement: function() {

		return this.featureGroup;

	},

	updateVis: function( colors ) {

		let renderColor = RenderPreprocessor.preProcessFmColor( colors, this.fmWidth, this.fmHeight );

		for ( let i = 0; i < renderColor.length; i++ ) {

			this.dataArray[ i ] = renderColor[ i ] * 255;

		}

		this.dataTexture.needsUpdate = true;
		this.featureMap.material = this.dataMaterial;

	},

	updatePos: function( pos ) {

		this.fmCenter.x = pos.x;
		this.fmCenter.y = pos.y;
		this.fmCenter.z = pos.z;
		this.featureGroup.position.set( pos.x, pos.y, pos.z );

	},

	clear: function() {

		let zeroValue = new Int8Array( this.neuralLength );
		let colors = ColorUtils.getAdjustValues( zeroValue, this.minOpacity );

		this.updateVis( colors );
		this.featureMap.material = this.clearMaterial;

	},

	setLayerIndex: function( layerIndex ) {

		this.featureMap.layerIndex = layerIndex;

	},

	setFmIndex: function( fmIndex ) {

		this.featureMap.fmIndex = fmIndex;

	},

	showText: function() {

		let widthInString = this.fmWidth.toString();
		let heightInString = this.fmHeight.toString();

		let material = new THREE.MeshBasicMaterial( { color: this.color } );

		let widthGeometry = new THREE.TextGeometry( widthInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let widthText = new THREE.Mesh( widthGeometry, material );

		let widthTextPos = TextHelper.calcFmWidthTextPos(

			widthInString.length,
			this.textSize,
			this.actualHeight,
			{

				x: this.featureMap.position.x,
				y: this.featureMap.position.y,
				z: this.featureMap.position.z

			}

		);

		widthText.position.set(

			widthTextPos.x,
			widthTextPos.y,
			widthTextPos.z

		);

		widthText.rotateX( - Math.PI / 2 );

		let heightGeometry = new THREE.TextGeometry( heightInString, {

			font: this.font,
			size: this.textSize,
			height: Math.min( this.unitLength, 1 ),
			curveSegments: 8

		} );

		let heightText = new THREE.Mesh( heightGeometry, material );

		let heightTextPos = TextHelper.calcFmHeightTextPos(

			heightInString.length,
			this.textSize,
			this.actualWidth,
			{

				x: this.featureMap.position.x,
				y: this.featureMap.position.y,
				z: this.featureMap.position.z

			}

		);

		heightText.position.set(

			heightTextPos.x,
			heightTextPos.y,
			heightTextPos.z

		);

		heightText.rotateX( - Math.PI / 2 );

		this.widthText = widthText;
		this.heightText = heightText;

		this.featureGroup.add( this.widthText );
		this.featureGroup.add( this.heightText );
		this.isTextShown = true;

	},

	hideText: function() {

		this.featureGroup.remove( this.widthText );
		this.featureGroup.remove( this.heightText );
		this.widthText = undefined;
		this.heightText = undefined;

		this.isTextShown = false;

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Strategy3d( mergedElements ) {

	this.mergedElements = mergedElements;
	this.layerIndex = undefined;

}

Strategy3d.prototype = {

	setLayerIndex: function( layerIndex ) {

		this.layerIndex = layerIndex;

	},

	validate: function() {

		return true;

	},

	getOutputShape: function() {

		return [ 1, 1, 1 ];

	},

	getRelativeElements: function( selectedElement ) {

		return {

			straight: [],
			curve: []

		};

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function StableMerge3d( mergedElements ) {

	Strategy3d.call( this, mergedElements );

}

StableMerge3d.prototype = Object.assign( Object.create( Strategy3d.prototype ), {

	validate: function() {

		let inputShape = this.mergedElements[ 0 ].outputShape;

		for ( let i = 0; i < this.mergedElements.length; i ++ ) {

			let outputShape = this.mergedElements[ i ].outputShape;

			for ( let j = 0; j < inputShape.length; j ++ ) {

				if ( outputShape[ j ] !== inputShape[ j ] ) {

					return false;

				}

			}

		}

		return true;

	},

	getOutputShape: function() {

		return this.mergedElements[ 0 ].outputShape;

	},

	getRelativeElements: function( selectedElement ) {

		let curveElements = [];
		let straightElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			let request = {

				all: true

			};

			for ( let i = 0; i < this.mergedElements.length; i ++ ) {

				let relativeResult = this.mergedElements[ i ].provideRelativeElements( request );
				let relativeElements = relativeResult.elementList;

				if ( this.mergedElements[ i ].layerIndex === this.layerIndex - 1 ) {

					for ( let j = 0; j < relativeElements.length; j ++ ) {

						straightElements.push( relativeElements[ j ] );

					}

				} else {

					if ( relativeResult.isOpen ) {

						for ( let j = 0; j < relativeElements.length; j ++ ) {

							straightElements.push( relativeElements[ j ] );
						}

					} else {

						for ( let j = 0; j < relativeElements.length; j ++ ) {

							curveElements.push( relativeElements[ j ] );

						}

					}

				}

			}

		} else if ( selectedElement.elementType === "featureMap" ) {

			let fmIndex = selectedElement.fmIndex;

			let request = {

				index: fmIndex

			};

			for ( let i = 0; i < this.mergedElements.length; i ++ ) {

				let relativeResult = this.mergedElements[ i ].provideRelativeElements( request );
				let relativeElements = relativeResult.elementList;

				if ( this.mergedElements[ i ].layerIndex === this.layerIndex - 1 ) {

					for ( let j = 0; j < relativeElements.length; j ++ ) {

						straightElements.push( relativeElements[ j ] );

					}

				} else {

					if ( relativeResult.isOpen ) {

						for ( let j = 0; j < relativeElements.length; j ++ ) {

							straightElements.push( relativeElements[ j ] );

						}

					} else {

						for ( let j = 0; j < relativeElements.length; j ++ ) {

							curveElements.push( relativeElements[ j ] );

						}

					}

				}

			}

		}

		return {

			straight: straightElements,
			curve: curveElements

		};

	}


} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Add3d( mergedElements ) {

	StableMerge3d.call( this, mergedElements );

	this.strategyType = "add3d";

}

Add3d.prototype = Object.assign( Object.create( StableMerge3d.prototype ) );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Concatenate3d( mergedElements ) {

	Strategy3d.call( this, mergedElements );

	this.strategyType = "concatenate3d";

}

Concatenate3d.prototype = Object.assign( Object.create( Strategy3d.prototype ), {

	validate: function() {

		let inputShape = this.mergedElements[ 0 ].outputShape;

		for ( let i = 0; i < this.mergedElements.length; i ++ ) {

			let layerShape = this.mergedElements[ i ].outputShape;

			if ( layerShape[ 0 ] !== inputShape[ 0 ] || layerShape[ 1 ] !== inputShape[ 1 ] ) {

				return false;

			}

		}

		return true;

	},

	getOutputShape: function() {

		let width = this.mergedElements[ 0 ].outputShape[ 0 ];
		let height = this.mergedElements[ 0 ].outputShape[ 1 ];
		let depth = 0;

		for (let i = 0; i < this.mergedElements.length; i ++) {

			depth += this.mergedElements[ i ].outputShape[ 2 ];

		}

		return [ width, height, depth ];

	},

	getRelativeElements: function( selectedElement ) {

		let curveElements = [];
		let straightElements = [];

		if ( selectedElement.elementType === "aggregationElement" ) {

			let request = {

				all: true

			};

			for ( let i = 0; i < this.mergedElements.length; i++ ) {

				let relativeResult = this.mergedElements[ i ].provideRelativeElements( request );
				let relativeElements = relativeResult.elementList;

				if ( this.mergedElements[ i ].layerIndex === this.layerIndex - 1 ) {

					for ( let j = 0; j < relativeElements.length; j ++ ) {

						straightElements.push( relativeElements[ j ] );

					}

				} else {

					if ( relativeResult.isOpen ) {

						for ( let j = 0; j < relativeElements.length; j ++ ) {

							straightElements.push( relativeElements[ j ] );

						}

					} else {

						for ( let j = 0; j < relativeElements.length; j ++ ) {

							curveElements.push( relativeElements[ j ] );

						}

					}

				}

			}

		} else if ( selectedElement.elementType === "featureMap" ) {

			let fmIndex = selectedElement.fmIndex;

			let relativeLayer;

			for ( let i = 0; i < this.mergedElements.length; i ++ ) {

				let layerDepth = this.mergedElements[ i ].outputShape[ 2 ];

				if ( layerDepth >= fmIndex ) {

					relativeLayer = this.mergedElements[ i ];
					break;

				} else {

					fmIndex -= layerDepth;

				}

			}

			let request = {

				index: fmIndex

			};

			let relativeResult = relativeLayer.provideRelativeElements( request );
			let relativeElements = relativeResult.elementList;

			if ( relativeLayer.layerIndex === this.layerIndex - 1 ) {

				for ( let i = 0; i < relativeElements.length; i ++ ) {

					straightElements.push( relativeElements[ i ] );

				}

			} else {

				if ( relativeResult.isOpen ) {

					for ( let i = 0; i < relativeElements.length; i ++ ) {

						straightElements.push( relativeElements[ i ] );

					}

				} else {

					for ( let i = 0; i < relativeElements.length; i ++ ) {

						curveElements.push( relativeElements[ i ] );

					}

				}

			}

		}

		return {

			straight: straightElements,
			curve: curveElements

		};

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Subtract3d( mergedElements ) {

	StableMerge3d.call( this, mergedElements );

	this.strategyType = "subtract3d";

}

Subtract3d.prototype = Object.assign( Object.create( StableMerge3d.prototype ) );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Multiply3d( mergedElements ) {

	StableMerge3d.call( this, mergedElements );

	this.strategyType = "multiply3d";

}

Multiply3d.prototype = Object.assign( Object.create( StableMerge3d.prototype ) );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Dot3d( mergedElements ) {

	this.mergedElements = mergedElements;
	this.layerIndex = undefined;

}

Dot3d.prototype = {

	setLayerIndex: function( layerIndex ) {

		this.layerIndex = layerIndex;

	},

	validate: function() {

	},

	getShape: function() {

	},

	getRelativeElements: function() {

	}

};

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Maximum3d( mergedElements ) {

	StableMerge3d.call( this, mergedElements );

	this.strategyType = "maximum3d";

}

Maximum3d.prototype = Object.assign( Object.create( StableMerge3d.prototype ) );

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Average3d( mergedElements ) {

	StableMerge3d.call( this, mergedElements );

	this.strategyType = "average3d";

}

Average3d.prototype = Object.assign( Object.create( StableMerge3d.prototype ) );

/**
 * @author syt123450 / https://github.com/syt123450
 */

let StrategyFactory = ( function() {

	function getOperationStrategy( operator, dimension, mergedElements ) {

		if ( dimension === 3 ) {

			if ( operator === "add" ) {

				return new Add3d( mergedElements );

			} else if ( operator === "concatenate" ) {

				return new Concatenate3d( mergedElements );

			} else if ( operator === "subtract" ) {

				return new Subtract3d( mergedElements );

			} else if ( operator === "multiply" ) {

				return new Multiply3d( mergedElements );

			} else if ( operator === "dot" ) {

				return new Dot3d( mergedElements );

			} else if ( operator === "maximum" ) {

				return new Maximum3d( mergedElements );

			} else if ( operator === "average" ) {

				return new Average3d( mergedElements );

			}

		} else if ( dimension === 2 ) {

		} else if ( dimension === 1 ) {

		}

	}

	return {

		getOperationStrategy: getOperationStrategy

	}

} )();

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * MergedLayer3d, can not be initialized by TensorSpace user, initialized by merge function.
 * MergedLayer3d is actually a context in strategy design pattern.
 * Different merge functions has different concrete strategies for mergedLayer3d.
 * Can add Add3d, Average3d, Concatenate3d, Dot3d, Maximum3d, Subtract3d strategy to MergedLayer3d.
 * Checkout "merge" folder for more information.
 *
 * @param config, user's configuration for merge function
 * @constructor
 */

function MergedLayer3d( config ) {

	// NativeLayer3d inherits from abstract layer "MergedLayer"

	MergedLayer.call( this, config );

	/**
	 * mergedLayer3d has three output dimensions: [ width, height, depth ].
	 *
	 * @type { int }
	 */

	this.width = undefined;
	this.height = undefined;
	this.depth = undefined;

	/**
	 * Feature map's handlers list.
	 *
	 * @type { Array }
	 */

	this.segregationHandlers = [];

	/**
	 * Feature maps's centers when layer is totally open.
	 *
	 * @type { Array }
	 */

	this.openFmCenters = [];

	/**
	 * Feature maps' centers when layer is closed.
	 *
	 * @type { Array }
	 */

	this.closeFmCenters = [];

	/**
	 * Concrete strategy in runtime.
	 * Initialized in MergedLayer3d's initStrategy period.
	 * Applicable strategy: Add3d, Average3d, Concatenate3d, Dot3d, Maximum3d, Multiply3d, Subtract3d.
	 *
	 * @type { Object }, Strategy3d
	 */

	this.operationStrategy = undefined;

	/**
	 * Label to define whether layer need an "output value" from backend model (tfjs, keras, or tf).
	 * False means that user need to add value for MergedLayer3d when they are preprocessing multi-output for the model.
	 *
	 * @type { boolean }
	 */

	this.autoOutputDetect = false;

	// Init concrete strategy based on config.

	this.initStrategy( config );

	this.layerDimension = 3;

	this.layerType = "MergedLayer3d";

}

MergedLayer3d.prototype = Object.assign( Object.create( MergedLayer.prototype ), {

	/**
	 * ============
	 *
	 * Functions below override base class MergedLayer's abstract method
	 *
	 * MergedLayer3d overrides MergedLayer's function:
	 * init, assemble, updateValue, clear, handleClick, handleHoverIn, handleHoverOut, loadModelConfig,
	 * calcCloseButtonSize, calcCloseButtonPos, getRelativeElements, provideRelativeElements, getBoundingWidth
	 *
	 * ============
	 */

	/**
	 * init() create actual THREE.Object in MergedLayer3d, warp them into a group, and add it to THREE.js's scene.
	 *
	 * Model passes two parameters, center and actualDepth, to MergedLayer3d when call init() to initialize MergedLayer3d.
	 *
	 * @param { JSON } center, layer's center (x, y, z) relative to model
	 * @param { double } actualDepth, layer aggregation's depth
	 */

	init: function( center, actualDepth ) {

		this.center = center;
		this.actualDepth = actualDepth;

		// Init a neuralGroup as the wrapper for all THREE.Object in MergedLayer3d.

		this.neuralGroup = new THREE.Group();
		this.neuralGroup.position.set( this.center.x, this.center.y, this.center.z );

		// depth === 1 means that there is only one feature map in MergedLayer3d, no need for aggregation, open layer, or close layer.

		if ( this.depth === 1 ) {

			// Open layer and init one feature map (depth === 1) without initializing close button.

			this.isOpen = true;
			this.initSegregationElements( this.openFmCenters );

		} else {

			if ( this.isOpen ) {

				// Init all feature maps and display them to totally opened positions.

				this.initSegregationElements( this.openFmCenters );

				// Init close button.

				this.initCloseButton();

			} else {

				// Init aggregation when layer is closed.

				this.initAggregationElement();

			}

		}

		// Add the wrapper object to the actual THREE.js scene.

		this.scene.add( this.neuralGroup );

		// Create relative line element.

		this.addLineGroup();

	},

	/**
	 * assemble() configure layer's index in model, calculate the shape and parameters based on previous layer.
	 *
	 * @param { int } layerIndex, this layer's order in model
	 */

	assemble: function( layerIndex ) {

		this.layerIndex = layerIndex;

		// Set layer index to strategy, operationStrategy can know which layer it has been positioned.

		this.operationStrategy.setLayerIndex( this.layerIndex );

		// Validate whether user's input merged elements can be merged in this kind of merge operation.

		if( !this.operationStrategy.validate() ) {

			console.error( "Input shape is not valid for " + this.operator + " merge function." );

		}

		// Get output shape after merge operation.

		this.outputShape = this.operationStrategy.getOutputShape();

		this.inputShape = this.outputShape;

		// The layer's shape is based on output shape.

		this.width = this.outputShape[ 0 ];
		this.height = this.outputShape[ 1 ];
		this.depth = this.outputShape[ 2 ];

		// Unit length is the same as merged elements, use unit length to calculate actualWidth and actualHeight which are used to create three.js object.

		this.unitLength = this.mergedElements[ 0 ].unitLength;
		this.actualWidth = this.unitLength * this.width;
		this.actualHeight = this.unitLength * this.height;

		// Calculate the feature map centers for close status.

		for ( let i = 0; i < this.depth; i ++ ) {

			let center = {

				x: 0,
				y: 0,
				z: 0

			};

			this.closeFmCenters.push( center );

		}

		// Calculate the feature map centers for open status.

		this.openFmCenters = FmCenterGenerator.getFmCenters(

			this.layerShape,
			this.depth,
			this.actualWidth,
			this.actualHeight

		);

	},

	/**
	 * updateValue() accept layer output value from model, update layer visualization if required.
	 *
	 * Model passes layer's output value to layer through updateValue method.
	 *
	 * @param { double[] } value, neural output value.
	 */

	updateValue: function ( value ) {

		// Store layer output value in "neuralValue" attribute, this attribute can be get by TensorSpace user.

		this.neuralValue = value;

		if ( this.isOpen ) {

			// If layer is open, update feature maps' visualization.

			this.updateSegregationVis();

		} else {

			// If layer is closed, update feature maps' aggregation's visualization.

			this.updateAggregationVis();

		}

	},

	/**
	 * clear() clear data and visualization in layer.
	 */

	clear: function() {

		if ( this.neuralValue !== undefined ) {

			// Use handlers to clear visualization.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

					this.segregationHandlers[ i ].clear();

				}

			} else {

				this.aggregationHandler.clear();

			}

			// Clear layer data.

			this.neuralValue = undefined;

		}

	},

	/**
	 * handleClick() If clickable element in this layer is clicked, execute this handle function.
	 *
	 * @param { THREE.Object } clickedElement, clicked element picked by model's Raycaster.
	 */

	handleClick: function( clickedElement ) {

		if ( clickedElement.elementType === "aggregationElement" ) {

			// If aggregation element is clicked, open layer.

			this.openLayer();

		} else if ( clickedElement.elementType === "closeButton" ) {

			// If close button is clicked, close layer.

			this.closeLayer();

		}

	},

	/**
	 * handleHoverIn() If hoverable element in this layer picked by Raycaster, execute this handle function.
	 *
	 * @param { THREE.Object } hoveredElement, hovered element picked by model's Raycaster.
	 */

	handleHoverIn: function( hoveredElement ) {

		// If relationSystem is enabled, show relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.showLines( hoveredElement );

		}

		// If textSystem is enabled, show hint text, for example, show feature map size.

		if ( this.textSystem ) {

			this.showText( hoveredElement );

		}

	},

	/**
	 * handleHoverOut() called by model if mouse hover out of this layer.
	 */

	handleHoverOut: function() {

		// If relationSystem is enabled, hide relation lines.

		if ( this.relationSystem ) {

			this.lineGroupHandler.hideLines();

		}

		// If textSystem is enabled, hide hint text, for example, hide feature map size.

		if ( this.textSystem ) {

			this.hideText();

		}

	},

	/**
	 * loadModelConfig() load model's configuration into MergedLayer3d object,
	 * If one specific attribute has been set before, model's configuration will not be loaded into it.
	 *
	 * Based on the passed in modelConfig parameter
	 *
	 * @param { JSON } modelConfig, default and user's configuration for model
	 */

	loadModelConfig: function( modelConfig ) {

		// Call super class "Layer"'s method to load common model configuration, check out "Layer.js" file for more information.

		this.loadBasicModelConfig( modelConfig );

		if ( this.layerShape === undefined ) {

			this.layerShape = modelConfig.layerShape;

		}

		if ( this.aggregationStrategy === undefined ) {

			this.aggregationStrategy = modelConfig.aggregationStrategy;

		}

		if ( this.color === undefined ) {

			this.color = modelConfig.color[ this.operator ];

		}

	},

	/**
	 * calcCloseButtonSize() get close button size.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { number } size, close button size
	 */

	calcCloseButtonSize: function() {

		// Total height when layer is open.

		let openHeight = this.actualHeight + this.openFmCenters[ this.openFmCenters.length - 1 ].z - this.openFmCenters[ 0 ].z;

		return openHeight * CloseButtonRatio;

	},

	/**                                                                                                                                                 y        y                        /**
	 * calcCloseButtonPos() get close button position.
	 * Called by initCloseButton function in abstract class "Layer",
	 *
	 * @return { JSON } position, close button position, relative to layer.
	 */

	calcCloseButtonPos: function() {

		let leftMostCenter = this.openFmCenters[ 0 ];
		let buttonSize = this.calcCloseButtonSize();

		return {

			x: leftMostCenter.x - this.actualWidth / 2 - 2 * buttonSize,
			y: 0,
			z: 0

		};

	},

	/**
	 * getRelativeElements() get relative element in last layer for relative lines based on given hovered element.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { THREE.Object } selectedElement, hovered element detected by THREE's Raycaster.
	 * @return { THREE.Object[] } relativeElements
	 */

	getRelativeElements: function( selectedElement ) {

		// As different merge functions have different relative element strategies, call concrete strategy to get relative elements.

		return this.operationStrategy.getRelativeElements( selectedElement );

	},

	/**
	 * provideRelativeElements() return relative elements.
	 *
	 * Use bridge design patten:
	 * 1. "getRelativeElements" send request to previous layer for relative elements;
	 * 2. Previous layer's "provideRelativeElements" receives request, return relative elements.
	 *
	 * @param { JSON } request, parameter configured by request layer
	 * @return { Object } { isOpen: boolean, elementList: elements }
	 */

	provideRelativeElements: function( request ) {

		let relativeElements = [];

		if ( request.all !== undefined && request.all ) {

			// When "all" attribute in request is true, return all elements displayed in this layer.

			if ( this.isOpen ) {

				for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

					relativeElements.push( this.segregationHandlers[ i ].getElement() );

				}

			} else {

				relativeElements.push( this.aggregationHandler.getElement() );

			}

		} else {

			if ( request.index !== undefined ) {

				if ( this.isOpen ) {

					// If index attribute is set in request, and layer is open, return feature map element which has the same index.

					relativeElements.push( this.segregationHandlers[ request.index ].getElement() );

				} else {

					// If layer is closed, return aggregation element.

					relativeElements.push( this.aggregationHandler.getElement() );

				}

			}

		}

		return {

			isOpen: this.isOpen,
			elementList: relativeElements

		};

	},

	/**
	 * getBoundingWidth(), provide bounding box's width based on layer's status.
	 *
	 * @return { number }
	 */

	getBoundingWidth: function() {

		if ( ( this.isOpen && !this.isWaitClose ) || this.isWaitOpen ) {

			let maxX = this.openFmCenters[ 0 ].x;

			for ( let i = 0; i < this.openFmCenters.length; i ++ ) {

				maxX = this.openFmCenters[ i ].x > maxX ? this.openFmCenters[ i ].x : maxX;

			}

			return maxX - this.calcCloseButtonPos().x + this.calcCloseButtonSize() + this.actualWidth;

		} else {

			return this.actualWidth;

		}

	},

	/**
	 * ============
	 *
	 * Functions above override base class MergedLayer's abstract method.
	 *
	 * ============
	 */

	/**
	 * openLayer() open MergedLayer3d, switch layer status from "close" to "open".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	openLayer: function() {

		if ( !this.isOpen ) {

			// MapTransitionFactory handles actual open animation, checkout "MapTransitionTween.js" for more information.

			MapTransitionFactory.openLayer( this );

		}

	},

	/**
	 * closeLayer() close MergedLayer3d, switch layer status from "open" to "close".
	 *
	 * This API is exposed to TensorSpace user.
	 */

	closeLayer: function() {

		if ( this.isOpen ) {

			// MapTransitionFactory handles actual close animation, checkout "MapTransitionTween.js" for more information.

			MapTransitionFactory.closeLayer( this );

		}

	},

	/**
	 * loadLayerConfig() init concrete strategy for MergedLayer3d.
	 * Create Strategy object and set it to MergedLayer3d based on layerConfig.
	 *
	 * @param { JSON } layerConfig, user's configuration and merge function's configuration for MergedLayer3d.
	 */

	initStrategy: function( layerConfig ) {

		if ( layerConfig !== undefined ) {

			// Get operator.

			if ( layerConfig.operator !== undefined ) {

				this.operator = layerConfig.operator;

			}

			// Get mergedElements.

			if ( layerConfig.mergedElements !== undefined ) {

				for ( let i = 0; i < layerConfig.mergedElements.length; i ++ ) {

					this.mergedElements.push( layerConfig.mergedElements[ i ] );

				}

			}

			// Get concrete strategy from factory.

			this.operationStrategy = StrategyFactory.getOperationStrategy( this.operator, 3, this.mergedElements );

		}

	},

	/**
	 * initSegregationElements() create feature maps's THREE.js Object, configure them, and add them to neuralGroup in MergedLayer3d.
	 *
	 * @param { JSON[] } centers, list of feature map's center (x, y, z), relative to layer
	 */

	initSegregationElements: function( centers ) {

		for ( let i = 0; i < this.depth; i ++ ) {

			// MergedFeatureMap Object is a wrapper for one feature map in mergedLayer3d, checkout "MergedFeatureMap.js" for more information.

			let segregationHandler = new MergedFeatureMap(

				this.operator,
				this.width,
				this.height,
				this.unitLength,
				centers[ i ],
				this.color,
				this.minOpacity

			);

			// Set layer index to feature map, feature map object can know which layer it has been positioned.

			segregationHandler.setLayerIndex( this.layerIndex );

			// Set feature map index.

			segregationHandler.setFmIndex( i );

			// Store handler for merged feature map for latter use.

			this.segregationHandlers.push( segregationHandler );

			// Get actual THREE.js element and add it to layer wrapper Object.

			this.neuralGroup.add( segregationHandler.getElement() );

		}

		// Update all merged feature maps' visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateSegregationVis();

		}

	},

	/**
	 * disposeSegregationElements() remove merged feature maps from neuralGroup, clear their handlers, and dispose their THREE.js Object in MergedLayer3d.
	 */

	disposeSegregationElements: function() {

		for ( let i = 0; i < this.segregationHandlers.length; i ++ ) {

			// Remove feature maps' THREE.js object from neuralGroup.

			let segregationHandler = this.segregationHandlers[ i ];
			this.neuralGroup.remove( segregationHandler.getElement() );

		}

		// Clear handlers, actual objects will automatically be GC.

		this.segregationHandlers = [];

	},

	/**
	 * initAggregationElement() create layer aggregation's THREE.js Object, configure it, and add it to neuralGroup in MergedLayer3d.
	 */

	initAggregationElement: function() {

		// MergedAggregation Object is a wrapper for merged feature maps's aggregation, checkout "MergedAggregation.js" for more information.

		let aggregationHandler = new MergedAggregation(

			this.operator,
			this.width,
			this.height,
			this.unitLength,
			this.actualDepth,
			this.color,
			this.minOpacity

		);

		// Set layer index to aggregation, aggregation object can know which layer it has been positioned.

		aggregationHandler.setLayerIndex( this.layerIndex );

		// Store handler for aggregation for latter use.

		this.aggregationHandler = aggregationHandler;

		// Get actual THREE.js element and add it to layer wrapper Object.

		this.neuralGroup.add( aggregationHandler.getElement() );

		// Update aggregation's visualization if layer's value has already been set.

		if ( this.neuralValue !== undefined ) {

			this.updateAggregationVis();

		}

	},

	/**
	 * disposeAggregationElement() remove aggregation from neuralGroup, clear its handler, and dispose its THREE.js Object in MergedLayer3d.
	 */

	disposeAggregationElement: function() {

		this.neuralGroup.remove( this.aggregationHandler.getElement() );
		this.aggregationHandler = undefined;

	},

	/**
	 * updateAggregationVis() update feature maps' aggregation's visualization.
	 */

	updateAggregationVis: function() {

		// Generate aggregation data from layer's raw output data. Checkout "ChannelDataGenerator.js" for more information.

		let aggregationUpdateValue = ChannelDataGenerator.generateAggregationData(

			this.neuralValue,
			this.depth,
			this.aggregationStrategy

		);

		// Get colors to render the surface of aggregation.

		let colors = ColorUtils.getAdjustValues( aggregationUpdateValue, this.minOpacity );

		// aggregationHandler execute update visualization process.

		this.aggregationHandler.updateVis( colors );

	},

	/**
	 * updateSegregationVis() update feature maps' visualization.
	 */

	updateSegregationVis: function() {

		// Generate feature map data from layer's raw output data. Checkout "ChannelDataGenerator.js" for more information.

		let layerOutputValues = ChannelDataGenerator.generateChannelData( this.neuralValue, this.depth );

		let featureMapSize = this.width * this.height;

		// Each feature map handler execute its own update function.

		for ( let i = 0; i < this.depth; i ++ ) {

			// Get colors to render the surface of feature maps.

			let colors = ColorUtils.getAdjustValues(

				layerOutputValues.slice( i * featureMapSize, ( i + 1 ) * featureMapSize ),
				this.minOpacity

			);

			this.segregationHandlers[ i ].updateVis( colors );

		}

	},

	/**
	 * showText() show hint text relative to given element.
	 *
	 * @param { THREE.Object } element
	 */

	showText: function( element ) {

		if ( element.elementType === "featureMap" ) {

			let fmIndex = element.fmIndex;
			this.segregationHandlers[ fmIndex ].showText();
			this.textElementHandler = this.segregationHandlers[ fmIndex ];

		}

	},

	/**
	 * hideText() hide hint text.
	 */

	hideText: function() {

		if ( this.textElementHandler !== undefined ) {

			this.textElementHandler.hideText();
			this.textElementHandler = undefined;

		}

	}

} );

/**
 * @author syt123450 / https://github.com/syt123450
 */

/**
 * Performs element-wise addition on layers.
 *
 * @param layerList, input a list of layers.
 * @param config, user's config for add function
 * @constructor
 */

function Add( layerList, config ) {

	let operatorType = "add";

	validate( layerList );

	return createMergedLayer( layerList, config );

	function validate( layerList ) {

		let depth;

		if ( layerList.length > 0 ) {

			depth = layerList[ 0 ].layerDimension;

		} else {

			console.error( "Merge Layer missing elements." );

		}

		for ( let i = 0; i < layerList.length; i ++ ) {

			if ( layerList[ i ].layerDimension !== depth ) {

				console.error( "Can not add layer with different depth." );

			}

		}

	}

	function createMergedLayer( layerList, userConfig ) {

		if ( layerList[ 0 ].layerDimension === 1 ) {

		} else if ( layerList[ 0 ].layerDimension === 2 ) {

		} else if ( layerList[ 0 ].layerDimension === 3 ) {

			return new MergedLayer3d( {

				operator: operatorType,
				mergedElements: layerList,
				userConfig: userConfig

			} );

		} else {

			console.error( "Do not support layer add operation more than 4 dimension." );

		}

	}

}

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Concatenate( layerList, config ) {

	let operatorType = "concatenate";

	validate( layerList );

	return createMergedLayer( layerList, config );

	function validate( layerList ) {

		let depth;

		if ( layerList.length > 0 ) {

			depth = layerList[ 0 ].layerDimension;

		} else {

			console.error( "Merge Layer missing elements." );

		}

		for ( let i = 0; i < layerList.length; i ++ ) {

			if ( layerList[ i ].layerDimension !== depth ) {

				console.error( "Can not add layer with different depth." );

			}

		}

	}

	function createMergedLayer( layerList, userConfig ) {

		if ( layerList[ 0 ].layerDimension === 1 ) {

		} else if ( layerList[ 0 ].layerDimension === 2 ) {

		} else if ( layerList[ 0 ].layerDimension === 3 ) {

			return new MergedLayer3d( {

				operator: operatorType,
				mergedElements: layerList,
				userConfig: userConfig

			} );

		} else {

			console.error( "Do not support layer concatenate operation more than 4 dimension." );

		}

	}

}

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Subtract( layerList, config ) {

	let operatorType = "subtract";

	validate( layerList );

	return createMergedLayer( layerList, config );

	function validate( layerList ) {

		let depth;

		if ( layerList.length > 0 ) {

			depth = layerList[ 0 ].layerDimension;

		} else {

			console.error( "Merge Layer missing elements." );

		}

		for ( let i = 0; i < layerList.length; i ++ ) {

			if ( layerList[ i ].layerDimension !== depth ) {

				console.error( "Can not add layer with different depth." );

			}

		}

	}

	function createMergedLayer( layerList, userConfig ) {

		if ( layerList[ 0 ].layerDimension === 1 ) {

		} else if ( layerList[ 0 ].layerDimension === 2 ) {

		} else if ( layerList[ 0 ].layerDimension === 3 ) {

			return new MergedLayer3d( {

				operator: operatorType,
				mergedElements: layerList,
				userConfig: userConfig

			} );

		} else {

			console.error( "Do not support layer add operation more than 4 dimension." );

		}

	}

}

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Maximum( layerList, config ) {

	let operatorType = "maximum";

	validate( layerList );

	return createMergedLayer( layerList, config );

	function validate( layerList ) {

		let depth;

		if ( layerList.length > 0 ) {

			depth = layerList[ 0 ].layerDimension;

		} else {

			console.error( "Merge Layer missing elements." );

		}

		for ( let i = 0; i < layerList.length; i ++ ) {

			if ( layerList[ i ].layerDimension !== depth ) {

				console.error( "Can not add layer with different depth." );

			}

		}

	}

	function createMergedLayer( layerList, userConfig ) {

		if ( layerList[ 0 ].layerDimension === 1 ) {

		} else if ( layerList[ 0 ].layerDimension === 2 ) {

		} else if ( layerList[ 0 ].layerDimension === 3 ) {

			return new MergedLayer3d( {

				operator: operatorType,
				mergedElements: layerList,
				userConfig: userConfig

			} );

		} else {

			console.error( "Do not support layer add operation more than 4 dimension." );

		}

	}

}

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Average( layerList, config ) {

	let operatorType = "average";

	validate( layerList );

	return createMergedLayer( layerList, config );

	function validate( layerList ) {

		let depth;

		if ( layerList.length > 0 ) {

			depth = layerList[0].layerDimension;

		} else {

			console.error( "Merge Layer missing elements." );

		}

		for ( let i = 0; i < layerList.length; i ++ ) {

			if ( layerList[ i ].layerDimension !== depth ) {

				console.error( "Can not add layer with different depth." );

			}

		}

	}

	function createMergedLayer( layerList, userConfig ) {

		if ( layerList[ 0 ].layerDimension === 1 ) {

		} else if ( layerList[ 0 ].layerDimension === 2 ) {

		} else if ( layerList[ 0 ].layerDimension === 3 ) {

			return new MergedLayer3d( {

				operator: operatorType,
				mergedElements: layerList,
				userConfig: userConfig

			} );

		} else {

			console.error( "Do not support layer add operation more than 4 dimension." );

		}

	}

}

/**
 * @author syt123450 / https://github.com/syt123450
 */

function Multiply( layerList, config ) {

	let operatorType = "multiply";

	validate( layerList );

	return createMergedLayer( layerList, config );

	function validate( layerList ) {

		let depth;

		if ( layerList.length > 0 ) {

			depth = layerList[ 0 ].layerDimension;

		} else {

			console.error( "Merge Layer missing elements." );

		}

		for ( let i = 0; i < layerList.length; i ++ ) {

			if ( layerList[ i ].layerDimension !== depth ) {

				console.error( "Can not add layer with different depth." );

			}

		}

	}

	function createMergedLayer( layerList, userConfig ) {

		if ( layerList[ 0 ].layerDimension === 1 ) {

		} else if ( layerList[ 0 ].layerDimension === 2 ) {

		} else if ( layerList[ 0 ].layerDimension === 3 ) {

			return new MergedLayer3d( {

				operator: operatorType,
				mergedElements: layerList,
				userConfig: userConfig

			} );

		} else {

			console.error( "Do not support layer add operation more than 4 dimension." );

		}

	}

}

/**
 * @author syt123450 / https://github.com/syt123450
 */

// import { Dot } from "./merge/Dot";
let layers = {

	Input1d: Input1d,
	GreyscaleInput: GreyscaleInput,
	RGBInput: RGBInput,
	Output1d: Output1d,
	OutputDetection: OutputDetection,
	YoloGrid: YoloGrid,
	Conv1d: Conv1d,
	Conv2d: Conv2d,
	Conv2dTranspose: Conv2dTranspose,
	DepthwiseConv2d: DepthwiseConv2d,
	Cropping1d: Cropping1d,
	Cropping2d: Cropping2d,
	Dense: Dense,
	Flatten: Flatten,
	Reshape: Reshape,
	Pooling1d: Pooling1d,
	Pooling2d: Pooling2d,
	Padding1d: Padding1d,
	Padding2d: Padding2d,
	GlobalPooling1d: GlobalPooling1d,
	GlobalPooling2d: GlobalPooling2d,
	UpSampling1d: UpSampling1d,
	UpSampling2d: UpSampling2d,
	Layer1d: BasicLayer1d,
	Layer2d: BasicLayer2d,
	Layer3d: BasicLayer3d,
	Activation1d: Activation1d,
	Activation2d: Activation2d,
	Activation3d: Activation3d,

	Add: Add,
	Concatenate: Concatenate,
	Subtract: Subtract,
	// Dot: Dot,
	Multiply: Multiply,
	Average: Average,
	Maximum: Maximum

};

let models = {

	Sequential: Sequential,
	Model: Model

};

exports.models = models;
exports.layers = layers;

return exports;

}({}));
