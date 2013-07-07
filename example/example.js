"use strict"

var shell = require("gl-now")()
var createTileMap = require("gl-tile-map")
var createBuffer = require("gl-buffer")
var createVAO = require("gl-vao")
var glm = require("gl-matrix")
var ndarray = require("ndarray")
var fill = require("ndarray-fill")
var ops = require("ndarray-ops")
var terrain = require("isabella-texture-pack")
var createAOMesh = require("ao-mesher")
var createAOShader = require("../aoshader.js")
var mat4 = glm.mat4

//The shader
var shader

//Tile texture
var texture

//Mesh data variables
var vao, vertexCount

shell.on("gl-init", function() {
  var gl = shell.gl

  //Create shader
  shader = createAOShader(gl)
  
  //Create some voxels
  var voxels = ndarray(new Uint16Array(32*32*32), [32,32,32])
  voxels.set(16,16,16, 1<<15)
  
  fill(voxels, function(i,j,k) {
    var x = Math.abs(i - 16)
    var y = Math.abs(j - 16)
    var z = Math.abs(k - 16)
    if(x*x+y*y+z*z < 30) {
      if(k < 16) {
        return 1<<15
      }
      return (1<<15)+1
    }
    return 0
  })
  
  //Compute mesh
  var vert_data = createAOMesh(voxels)
  
  //Convert mesh to WebGL buffer
  vertexCount = Math.floor(vert_data.length/8)
  var vert_buf = createBuffer(gl, vert_data)
  vao = createVAO(gl, undefined, [
    { "buffer": vert_buf,
      "type": gl.UNSIGNED_BYTE,
      "size": 4,
      "offset": 0,
      "stride": 8,
      "normalized": false
    },
    { "buffer": vert_buf,
      "type": gl.UNSIGNED_BYTE,
      "size": 4,
      "offset": 4,
      "stride": 8,
      "normalized": false
    }
  ])
  
  var tiles = ndarray(terrain.data,
    [16,16,terrain.shape[0]>>4,terrain.shape[1]>>4,4],
    [terrain.stride[0]*16, terrain.stride[1]*16, terrain.stride[0], terrain.stride[1], terrain.stride[2]], 0)
  texture = createTileMap(gl, tiles, true)
  texture.mipSamples = 4
})

shell.on("gl-render", function(t) {
  var gl = shell.gl

  gl.enable(gl.CULL_FACE)
  gl.enable(gl.DEPTH_TEST)

  //Bind the shader
  shader.bind()
  
  //Set shader attributes
  shader.attributes.attrib0.location = 0
  shader.attributes.attrib1.location = 1
  
  //Set up camera parameters
  var A = new Float32Array(16)
  shader.uniforms.projection = mat4.perspective(A, Math.PI/4.0, shell.width/shell.height, 1.0, 1000.0)
  
  var t = 0.0001*Date.now()
  
  shader.uniforms.view = mat4.lookAt(A, [30*Math.cos(t) + 16,20,30*Math.sin(t)+16], [16,16,16], [0, 1, 0])

  //Set tile size
  shader.uniforms.tileSize = 16.0
  
  //Set texture
  if(texture) {
    shader.uniforms.tileMap = texture.bind()
  }
  
  //Draw instanced mesh
  shader.uniforms.model = mat4.identity(A)
  vao.bind()
  gl.drawArrays(gl.TRIANGLES, 0, vertexCount)
  vao.unbind()
})
