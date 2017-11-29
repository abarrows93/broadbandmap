import nbMap from '../NBMap/'
import nbMapSidebar from '../NBMap/NBMapSidebar/'
import axios from 'axios'
import EventHub from '../../_mixins/EventHub.js'
import { urlValidation } from '../../_mixins/urlValidation.js'
import { sourcesTechSpeed, layersTechSpeed, layersSpeed } from '../NBMap/layers-techSpeed.js'
const d3 = require('d3')

export default {
  name: 'AreaSummary',
  components: { 'nbMap': nbMap, 'nbMapSidebar': nbMapSidebar },
  props: [],
  mixins: [urlValidation],
  data () {
    return {
      defaultTech: 'acfosw',
      defaultSpeed: '25_3'
    }
  },
  mounted () {
    this.fetchCombinedData()
    EventHub.$on('updateMapSettings', (selectedTech, selectedSpeed) => this.updateTechSpeed(selectedTech, selectedSpeed))
    EventHub.$on('removeLayers', (propertyID) => this.removeLayers(propertyID))
  },
  destroyed () {
    EventHub.$off('updateMapSettings')
    EventHub.$off('removeLayers')
  },
  methods: {
    mapInit (map, mapOptions) {
      const vm = this

      this.Map = map
      this.mapOptions = mapOptions

      // Show default tech and speed layers
      this.Map.on('load', function () {
        vm.updateTechSpeed(vm.defaultTech, vm.defaultSpeed)
      })
    },
    addSources () {
      const vm = this

      // add sources for tech and speed map layers
      sourcesTechSpeed.forEach(source => {
        vm.Map.addSource(source.id, {
          url: source.url,
          type: source.type
        })
      })
    },
    addLayers (propertyID) {
      const vm = this
      const speed = propertyID.split('_')[1]

      let layers = [layersTechSpeed, layersSpeed[speed]]
      let layersLen = layers.length

      // template for layer style
      let layerStyle = {
        'layout': {
          'visibility': 'visible'
        },
        'maxzoom': 0,
        'type': 'fill',
        'source': '',
        'id': '',
        'paint': {
          'fill-color': {
            'base': 1,
            'type': 'exponential',
            'property': '',
            'stops': [
                  [0, '#ffffcc'],
                  [1, '#a1dab4'],
                  [2, '#41b6c4'],
                  [3, '#225ea8']
            ],
            'default': '#ffffcc'
          }
        },
        'source-layer': ''
      }

      // loop through each layer type and add to map
      for (let i = 0; i < layersLen; i++) {
        layers[i].forEach(layer => {
          let lyrStyle = {}

          layerStyle.paint['fill-color'].property = propertyID
          layerStyle['source-layer'] = layer.id

          lyrStyle = Object.assign({}, layerStyle, layer)

          vm.Map.addLayer(lyrStyle, layer.beforeLayer)
        })
      }
    },
    removeLayers (propertyID) { // e.g. acfosw_25_3
      const vm = this
      const speed = propertyID.split('_')[1]

      let layers = [layersTechSpeed, layersSpeed[speed]]
      let layersLen = layers.length

      // loop through each layer type and remove map
      for (let i = 0; i < layersLen; i++) {
        layers[i].forEach(layer => {
          let layerExists = vm.Map.getLayer(layer.id)

          if (layerExists) {
            vm.Map.removeLayer(layer.id)
          }
        })
      }
    },
    // Called by mounted() and Map.on('load')
    updateTechSpeed (selectedTech, selectedSpeed) { // e.g. acfosw, 25_3
      let propertyID = [selectedTech, selectedSpeed].join('_')
      // add layer sources if they don't exist already
      if (this.Map.getSource('county-techSpeed') === undefined || this.Map.getSource('block-techSpeed') === undefined) {
        this.addSources()
      } else {
        // remove existing map layers
        this.removeLayers(propertyID)
      }

      // add new map layers
      this.addLayers(propertyID)
    },
    fetchCombinedData () {
      const self = this
      let type = ''
      let id = 0
      let isValidType = ['state', 'county', 'place', 'cbsa', 'cd', 'tribal'].indexOf(this.$route.query.type) !== -1
      // If the geoid and geography type are in the query string, use those
      if (typeof this.$route.query.type !== 'undefined' && isValidType && typeof this.$route.query.geoid !== 'undefined') {
        type = this.$route.query.type
        id = this.$route.query.geoid
      // Set defaults
      } else {
        type = 'nation'
        id = 0
      }

      // Call Socrata API - Combined Table for charts
      let socrataURL = ''
      let appToken = ''
      let httpHeaders = {}
      if (process.env.SOCRATA_ENV === 'DEV') {
        socrataURL = process.env.SOCRATA_DEV_COMBINED
        httpHeaders = {
          // Dev: Authentication to Socrata using HTTP Basic Authentication
          'Authorization': 'Basic ' + process.env.SOCRATA_DEV_HTTP_BASIC_AUTHENTICATION
        }
      } else if (process.env.SOCRATA_ENV === 'PROD') {
        socrataURL = process.env.SOCRATA_PROD_COMBINED
        // Socrata does not currently enforce an app token, but may in the future
        appToken = process.env.SOCRATA_PROD_APP_TOKEN
      } else {
        console.log('ERROR: process.env.SOCRATA_ENV in .env file must be PROD or DEV, not ' + process.env.SOCRATA_ENV)
      }
      axios
      .get(socrataURL, {
        params: {
          id: id,
          type: type,
          tech: 'a',
          $order: 'speed',
          $$app_token: appToken
        },
        headers: httpHeaders
      })
      .then(function (response) {
        console.log('Socrata response= ', response)
        self.drawCombinedCharts(response)
      })
      .catch(function (error) {
        if (error.response) {
          // Server responded with a status code that falls out of the range of 2xx
          console.log(error.response.data)
          console.log(error.response.status)
          console.log(error.response.headers)
        } else if (error.request) {
          // Request was made but no response was received
          console.log(error.request)
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message)
        }
        console.log(error)
      })
    },
    drawCombinedCharts (response) {
      var data = response.data
      let totalPop = 0
      for (var index in data) {
        // Convert populations from strings to numbers
        data[index].has_0 = parseInt(data[index].has_0)
        data[index].has_1 = parseInt(data[index].has_1)
        data[index].has_2 = parseInt(data[index].has_2)
        data[index].has_3plus = parseInt(data[index].has_3plus)
        // Convert to percentages
        totalPop = data[index].has_0 + data[index].has_1 + data[index].has_2 + data[index].has_3plus
        data[index].has_0 = data[index].has_0 / totalPop * 100
        data[index].has_1 = data[index].has_1 / totalPop * 100
        data[index].has_2 = data[index].has_2 / totalPop * 100
        data[index].has_3plus = data[index].has_3plus / totalPop * 100
      }

      // Draw charts using the D3 library
      var svg = d3.select('svg')
      var margin = {top: 20, right: 20, bottom: 30, left: 40}
      var width = +svg.attr('width') - margin.left - margin.right
      var height = +svg.attr('height') - margin.top - margin.bottom
      var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

      var x = d3.scaleBand()
        .rangeRound([0, width])
        .paddingInner(0.05)
        .align(0.1)

      var y = d3.scaleLinear()
        .rangeRound([height, 0])

      var z = d3.scaleOrdinal()
        .range(['#e6eecf', '#9bc4c1', '#68a8b7', '#2e557a'])

      var keys = ['has_0', 'has_1', 'has_2', 'has_3plus']
      /* Do not sort
      data.sort(function(a, b) { return b.total - a.total; })
      */
      // X-domain
      x.domain(data.map(function (d) {
        return d.speed
      }))
      /* Use 100% instead
      y.domain([0, d3.max(data, function(d) { return d.total; })]).nice()
      */
      // Y-domain - Set range from 0% to 100%
      y.domain([0, 100]).nice()
      // Z-domain (Is this used?)
      z.domain(keys)

      // Bars
      g.append('g')
        .selectAll('g')
        .data(d3.stack().keys(keys)(data))
        .enter().append('g')
        .attr('fill', function (d) { return z(d.key) })
        .selectAll('rect')
        .data(function (d) { return d })
        .enter().append('rect')
        // .attr('x', function (d) { return x(d.data.speed) })
        .attr('x', function (d) {
          // console.log('d=', d)
          // console.log('x(d)=', x(d))
          return x(d.data.speed)
        })
        .attr('y', function (d) { return y(d[1]) })
        .attr('height', function (d) { return y(d[0]) - y(d[1]) })
        .attr('width', x.bandwidth())
        // .attr('width', 20)

      // X-axis
      g.append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x))

      // Y-axis
      g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(null, 's'))
        .append('text')
        .attr('x', 2)
        .attr('y', y(y.ticks().pop()) + 0.5 - 10)
        .attr('dy', '0.32em')
        .attr('fill', '#000')
        .attr('font-weight', 'bold')
        .attr('text-anchor', 'start')
        .text('% of population')

      /* Legend:
      var legend = g.append('g')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10)
        .attr('text-anchor', 'end')
        .selectAll('g')
        .data(keys.slice().reverse())
        .enter().append('g')
        .attr('transform', function(d, i) { return 'translate(0,' + i * 20 + ')'; });
      legend.append('rect')
        .attr('x', width - 19)
        .attr('width', 19)
        .attr('height', 19)
        .attr('fill', z);
      legend.append('text')
        .attr('x', width - 24)
        .attr('y', 9.5)
        .attr('dy', '0.32em')
        .text(function(d) { return d; });
      */
    }
  },
  computed: {

  },
  watch: {
    // When query params change for the same route (URL slug)
    '$route' (to, from) {
      this.fetchCombinedData()
    }
  }
}
