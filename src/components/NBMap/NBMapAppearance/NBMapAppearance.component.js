import { mapGetters, mapMutations } from 'vuex'

import { Modal } from 'uiv'
import { Chrome } from 'vue-color'

import EventHub from '../../../_mixins/EventHub.js'
import { urlValidation } from '../../../_mixins/urlValidation.js'

export default {
  name: 'MapAppearance',
  components: { Modal, 'color-picker': Chrome },
  mixins: [urlValidation],
  props: [],
  data () {
    return {
      showModal: false,
      mapSettings: {},
      opacity: this.getMapSettings().opacity,
      hlColors: this.getMapSettings().highlightColor,
      showWaterBlocks: this.getMapSettings().showWaterBlocks,
      showUnPopBlocks: this.getMapSettings().showUnPopBlocks,
      displayPicker: false
    }
  },
  mounted () {
    this.mapSettings = this.getMapSettings()

    EventHub.$on('openMapAppearance', () => {
      this.showModal = true
    })
  },
  destroyed () {
    EventHub.$off('openMapAppearance', () => {
      this.showModal = true
    })
  },
  methods: {
    ...mapGetters([
      // Mount store getters to component scope
      'getMapSettings'
    ]),
    ...mapMutations([
      // Mount store mutation functions
      'setMapSettings'
    ]),
    setOpacity (opacity) {
      // Reset opacity value if invalid
      if (opacity > 100 || opacity < 0 || opacity === '') {
        opacity = 0
        // Reset slider value
        this.opacity = 0
      }

      EventHub.$emit('setOpacity', opacity)
    },
    updateHighlight (useDefault) {
      if (useDefault) {
        this.hlColors = this.mapSettings.highlightColor
      }

      EventHub.$emit('updateHighlight', this.hlColors.hex)
    },
    showPicker () { // Show color picker
      this.displayPicker = true
      document.addEventListener('click', this.documentClick)
    },
    hidePicker () { // Hide color picker
      this.displayPicker = false
      document.removeEventListener('click', this.documentClick)
    },
    documentClick (e) { // Hide color picker when clicking outside the color picker DIV
      let el = document.getElementById('colorPicker')
      let target = e.target

      if (el !== target && !el.contains(target)) {
        this.hidePicker()
      }
    },
    setWaterBlocks () {
      EventHub.$emit('setWaterBlocks', !this.showWaterBlocks)
    },
    setUnPopBlocks () {
      EventHub.$emit('setUnPopBlocks', !this.showUnPopBlocks)
    },
    saveSettings () {
      console.log('saveSettings')
    },
    closeModal () {
      this.showModal = false
    }
  },
  watch: {
    '$route' (to, from) {
      // Reset modal data when page changes
      if (to.name !== from.name) {
        Object.assign(this.$data, this.$options.data.call(this))
      }
    }
  }
}
