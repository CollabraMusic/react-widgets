import React from 'react';
import activeElement from 'dom-helpers/activeElement';
import contains from'dom-helpers/query/contains';
import cx from 'classnames';
import _  from './util/_';
import Popup           from './Popup';
import compat          from './util/compat';
import CustomPropTypes from './util/propTypes';
import PlainList       from './List';
import GroupableList   from './ListGroupable';
import validateList    from './util/validateListInterface';
import createUncontrolledWidget from 'uncontrollable';

import { dataItem, dataText, dataIndexOf } from './util/dataHelpers';
import { widgetEditable, widgetEnabled, isDisabled, isReadOnly } from './util/interaction';
import { instanceId, notify, isFirstFocusedRender } from './util/widgetHelpers';

let { omit, pick, result } = _;

var propTypes = {
  //-- controlled props -----------
  value:          React.PropTypes.any,
  onChange:       React.PropTypes.func,
  open:           React.PropTypes.bool,
  onToggle:       React.PropTypes.func,
  //------------------------------------

  data:           React.PropTypes.array,
  valueField:     React.PropTypes.string,
  textField:      CustomPropTypes.accessor,

  valueComponent: CustomPropTypes.elementType,
  itemComponent:  CustomPropTypes.elementType,
  listComponent:  CustomPropTypes.elementType,

  groupComponent: CustomPropTypes.elementType,
  groupBy:        CustomPropTypes.accessor,

  onSelect:       React.PropTypes.func,

  searchTerm:     React.PropTypes.string,
  onSearch:       React.PropTypes.func,

  busy:           React.PropTypes.bool,

  delay:          React.PropTypes.number,

  dropUp:         React.PropTypes.bool,
  duration:       React.PropTypes.number, //popup

  disabled:       CustomPropTypes.disabled.acceptsArray,
  readOnly:       CustomPropTypes.readOnly.acceptsArray,

  messages:       React.PropTypes.shape({
    open:              CustomPropTypes.message,
    emptyList:         CustomPropTypes.message,
    emptyFilter:       CustomPropTypes.message,
    filterPlaceholder: CustomPropTypes.message
  })
};

var DropdownList = React.createClass({

  displayName: 'DropdownList',

  mixins: [
    require('./mixins/TimeoutMixin'),
    require('./mixins/PureRenderMixin'),
    require('./mixins/DataFilterMixin'),
    require('./mixins/PopupScrollToMixin'),
    require('./mixins/RtlParentContextMixin'),
    require('./mixins/AriaDescendantMixin')()
  ],

  propTypes: propTypes,

  getDefaultProps(){
    return {
      delay: 500,
      value: '',
      open: false,
      data: [],
      searchTerm: '',
      messages: msgs(),
      ariaActiveDescendantKey: 'dropdownlist'
    }
  },

  getInitialState(){
    let { open, filter, value, data, searchTerm, valueField } = this.props;

    var processed = filter ? this.filter(data, searchTerm) : data
      , initialIdx = dataIndexOf(data, value, valueField);

    return {
      filteredData: (open && filter) ? processed : null,
      selectedItem: processed[initialIdx],
      focusedItem:  processed[initialIdx] || data[0]
    }
  },

  componentDidUpdate() {
    this.refs.list
        && validateList(this.refs.list)
  },

  componentWillReceiveProps(props){
    let { open, filter, value, data, searchTerm, valueField } = props;

    var processed = filter ? this.filter(data, searchTerm) : data
      , idx = dataIndexOf(data, value, valueField);

    this.setState({
      filteredData: (open && filter) ? processed : null,
      selectedItem: processed[idx],
      focusedItem:  processed[!~idx ? 0 : idx]
    })
  },

  render() {
    let {
        className, tabIndex, filter
      , valueField, textField, groupBy
      , messages, data, busy, dropUp
      , placeholder, value, open
      , valueComponent: ValueComponent
      , listComponent: List } = this.props;

    List = List || (groupBy && GroupableList) || PlainList

    let elementProps = omit(this.props, Object.keys(propTypes));
    let listProps    = pick(this.props, Object.keys(List.propTypes));
    let popupProps   = pick(this.props, Object.keys(Popup.propTypes));

    let { focusedItem, selectedItem, focused } = this.state;

    let items = this._data()
      , disabled = isDisabled(this.props)
      , readOnly = isReadOnly(this.props)
      , valueItem = dataItem(data, value, valueField) // take value from the raw data
      , listID = instanceId(this, '__listbox');

    let shouldRenderList = isFirstFocusedRender(this) || open;

    messages = msgs(messages)

    return (
      <div {...elementProps}
        ref="input"
        role='combobox'
        tabIndex={tabIndex || '0'}
        aria-expanded={open }
        aria-haspopup={true}
        aria-owns={listID}
        aria-busy={!!busy}
        aria-live={!open && 'polite'}
        //aria-activedescendant={activeID}
        aria-autocomplete="list"
        aria-disabled={disabled }
        aria-readonly={readOnly }
        onKeyDown={this._keyDown}
        onClick={this._click}
        onFocus={this._focus.bind(null, true)}
        onBlur ={this._focus.bind(null, false)}
        className={cx(className, 'rw-dropdownlist', 'rw-widget', {
          'rw-state-disabled':  disabled,
          'rw-state-readonly':  readOnly,
          'rw-state-focus':     focused,
          'rw-rtl':             this.isRtl(),

          ['rw-open' + (dropUp ? '-up' : '')]: open
        })}>

        <span className="rw-dropdownlist-picker rw-select rw-btn">
          <i className={'rw-i rw-i-caret-down' + (busy ? ' rw-loading' : '')}>
            <span className="rw-sr">
              { result(messages.open, this.props) }
            </span>
          </i>
        </span>
        <div
          className="rw-input"
        >
          { !valueItem && placeholder
            ? <span className='rw-placeholder'>{placeholder}</span>
            : this.props.valueComponent
              ? <ValueComponent item={valueItem}/>
              : dataText(valueItem, textField)
          }
        </div>
        <Popup {...popupProps}
          onOpen={() => this.focus() }
          onOpening={() => this.refs.list.forceUpdate() }
        >
          <div>
            { filter && this._renderFilter(messages) }
            { shouldRenderList &&
              <List ref="list"
                {...listProps}
                data={items}
                id={listID}
                aria-live={open && 'polite'}
                aria-labelledby={instanceId(this)}
                aria-hidden={!this.props.open}
                selected={selectedItem}
                focused ={open ? focusedItem : null}
                onSelect={this._onSelect}
                onMove={this._scrollTo}
                messages={{
                  emptyList: data.length
                    ? messages.emptyFilter
                    : messages.emptyList
                }}/>
            }
          </div>
        </Popup>
      </div>
    )
  },

  _renderFilter(messages){
    return (
      <div ref='filterWrapper' className='rw-filter-input'>
        <span className='rw-select rw-btn'><i className='rw-i rw-i-search'/></span>
        <input ref='filter' className='rw-input'
          placeholder={_.result(messages.filterPlaceholder, this.props)}
          value={this.props.searchTerm }
          onChange={ e => notify(this.props.onSearch, e.target.value)}/>
      </div>
    )
  },

  @widgetEnabled
  _focus(focused, e){

    this.setTimeout('focus', () => {
      if( !focused) this.close()

      if( focused !== this.state.focused) {
        notify(this.props[focused ? 'onFocus' : 'onBlur'], e)
        this.setState({ focused: focused })
      }
    })
  },

  @widgetEditable
  _onSelect(data){
    this.close()
    notify(this.props.onSelect, data)
    this.change(data)
    this.focus(this)
  },

  @widgetEditable
  _click(e){
    var wrapper = this.refs.filterWrapper

    if( !this.props.filter || !this.props.open )
      this.toggle()

    else if( !contains(compat.findDOMNode(wrapper), e.target))
      this.close()

    notify(this.props.onClick, e)
  },

  @widgetEditable
  _keyDown(e){
    var self = this
      , key = e.key
      , alt = e.altKey
      , list = this.refs.list
      , filtering = this.props.filter
      , focusedItem = this.state.focusedItem
      , selectedItem = this.state.selectedItem
      , isOpen = this.props.open
      , closeWithFocus = () => { this.close(), compat.findDOMNode(this).focus()};

    notify(this.props.onKeyDown, [e])

    if (e.defaultPrevented)
      return

    if ( key === 'End' ) {
      if ( isOpen) this.setState({ focusedItem: list.last() })
      else         change(list.last())
      e.preventDefault()
    }
    else if ( key === 'Home' ) {
      if ( isOpen) this.setState({ focusedItem: list.first() })
      else         change(list.first())
      e.preventDefault()
    }
    else if ( key === 'Escape' && isOpen ) {
      closeWithFocus()
    }
    else if ( (key === 'Enter' || (key === ' ' && !filtering)) && isOpen ) {
      change(this.state.focusedItem, true)
    }
    else if ( key === 'ArrowDown' ) {
      if ( alt )         this.open()
      else if ( isOpen ) this.setState({ focusedItem: list.next(focusedItem) })
      else               change(list.next(selectedItem))
      e.preventDefault()
    }
    else if ( key === 'ArrowUp' ) {
      if ( alt )         closeWithFocus()
      else if ( isOpen ) this.setState({ focusedItem: list.prev(focusedItem) })
      else               change(list.prev(selectedItem))
      e.preventDefault()
    }
    else if ( !(this.props.filter && isOpen) )
      this.search(String.fromCharCode(e.keyCode), item => {
        isOpen
          ? this.setState({ focusedItem: item })
          : change(item)
      })

    function change(item, fromList){
      if(!item) return
      fromList
        ? self._onSelect(item)
        : self.change(item)
    }
  },

  change(data){
    if ( !_.isShallowEqual(data, this.props.value) ) {
      notify(this.props.onChange, data)
      notify(this.props.onSearch, '')
      this.close()
    }
  },

  focus(target){
    var inst = target || (this.props.filter && this.props.open ? this.refs.filter : this.refs.input);

    if ( activeElement() !== compat.findDOMNode(inst))
      compat.findDOMNode(inst).focus()
  },

  _data() {
    return this.state.filteredData || this.props.data.concat()
  },

  search(character, cb) {
    var word = ((this._searchTerm || '') + character).toLowerCase();

    this._searchTerm = word

    this.setTimeout('search', () => {
      var list = this.refs.list
        , key  = this.props.open ? 'focusedItem' : 'selectedItem'
        , item = list.next(this.state[key], word);

      this._searchTerm = ''
      if ( item) cb(item)

    }, this.props.delay)
  },

  open() {
    notify(this.props.onToggle, true)
  },

  close() {
    notify(this.props.onToggle, false)
  },

  toggle() {
    this.props.open
      ? this.close()
      : this.open()
  }

})

function msgs(msgs){
  return {
    open: 'open dropdown',
    filterPlaceholder: '',
    emptyList:   'There are no items in this list',
    emptyFilter: 'The filter returned no results',
    ...msgs
  }
}

export default createUncontrolledWidget(
    DropdownList, { open: 'onToggle', value: 'onChange', searchTerm: 'onSearch' });
