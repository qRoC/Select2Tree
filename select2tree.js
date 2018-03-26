/// (c) Andrey Savitsky <contact@qroc.pro>
(function($) {
  /**
   * @param {number} id
   * @param {TreeNode} parent
   * @param {!Array<!TreeNode>} childs
   * @param {string} title
   *
   * @constructor
   */
  function TreeNode(id, parent, childs, title) {
    /**
     * @type {number}
     * @private
     */
    this._id = id;

    /**
     * @type {TreeNode}
     * @private
     */
    this._parent = parent;

    /**
     * @type {!Array<!TreeNode>}
     * @private
     */
    this._childs = childs;

    /**
     * @type {string}
     * @private
     */
    this._title = title;
  }

  /**
   * @return {number}
   */
  TreeNode.prototype.getId = function() {
    return this._id;
  };

  /**
   * @return {TreeNode}
   */
  TreeNode.prototype.getParent = function() {
    return this._parent;
  };

  /**
   * @return {!Array<!TreeNode>}
   */
  TreeNode.prototype.getChilds = function() {
    return this._childs;
  };

  /**
   * @return {boolean}
   */
  TreeNode.prototype.hasChilds = function() {
    return this._childs.length > 0;
  };

  /**
   * @return {string}
   */
  TreeNode.prototype.getTitle = function() {
    return this._title;
  };

  /**
   *
   * @param {!TreeNode} shadowRoot
   * @param {!Array<!TreeNode>} nodes
   *
   * @constructor
   */
  function Tree(shadowRoot, nodes) {
    /**
     * @type {!TreeNode}
     * @private
     */
    this._shadowRoot = shadowRoot;

    /**
     * @type {!Array<!TreeNode>}
     * @private
     */
    this._nodes = nodes;
  }

  /**
   * @return {!Array<!TreeNode>}
   */
  Tree.prototype.getFirstLevelNodes = function() {
    return this._shadowRoot.getChilds();
  };

  /**
   * @return {TreeNode}
   */
  Tree.prototype.getShadowRoot = function() {
    return this._shadowRoot;
  };

  /**
   *
   * @param {number} id
   *
   * @return {TreeNode}
   */
  Tree.prototype.get = function(id) {
    if (typeof id === 'number') {
      for (var i = 0; i < this._nodes.length; i++) {
        if (this._nodes[i].getId() === id) {
          return this._nodes[i];
        }
      }
    }

    return null;
  };

  /**
   * @constructor
   */
  function TreeBuilder() {
    /**
     * @type {!Array<!Object>}
     * @private
     */
    this._rawElements = [];
  }

  /**
   *
   * @param {number} id
   * @param {number} parentId
   * @param {string} title
   */
  TreeBuilder.prototype.push = function(id, parentId, title) {
    this._rawElements.push({id: id, parentId: parentId, title: title});
  };

  /**
   * @return {!Tree}
   */
  TreeBuilder.prototype.build = function() {
    /**
     * @type {!Array<!Object>}
     */
    var untreated = this._rawElements;

    /**
     * @type {!Array<!TreeNode>}
     */
    var nodes = [new TreeNode(0, null, [], '')];

    var iteration = 0;

    while (untreated.length) {
      if (++iteration > 10000) {
        throw new Error('Error: Too many iterations');
      }

      /**
       * @type {!Array<!Object>}
       */
      var ignored = [];

      for (var i = 0; i < untreated.length; i++) {
        var rawElement = untreated[i];
        var isTreated = false;
        for (var j = 0; j < nodes.length; j++) {
          var parentNode = nodes[j];
          if (rawElement.parentId === parentNode.getId()) {
            var newNode = new TreeNode(
                rawElement.id,
                j !== 0 ? parentNode : null,
                [],
                rawElement.title
            );
            nodes.push(newNode);

            parentNode.getChilds().push(newNode);

            isTreated = true;
            break;
          }
        }
        if (!isTreated) {
          ignored.push(rawElement);
        }
      }

      untreated = ignored;
    }

    return new Tree(nodes.shift(), nodes);
  };

  /**
   * @param {!TreeNode} treeNode
   *
   * @return {string}
   */
  function getBreadcrumbLabel(treeNode) {
    if (!treeNode.getParent()) {
      return treeNode.getTitle();
    }

    var elements = [];
    while (treeNode) {
      elements.push(treeNode.getTitle());
      treeNode = treeNode.getParent();
    }

    return elements.join(' / ');
  }

  /**
   *
   * @param {!Object} select2
   * @param {Function} handler
   *
   * @constructor
   */
  function Select2BackButtonModifier(select2, handler) {
    this.$searchContainer = select2.dropdown.$searchContainer;
    this.handler = handler;

    this.$backContainer = $('<span class="input-group-btn select2tree_back_container">' +
        '        <button class="btn btn-default select2tree_back" type="button">' +
        '          <i class="fa fa-angle-left"></i>' +
        '        </button>' +
        '      </span>');
    this.$backContainer.find('.select2tree_back').on('click', handler);
  }

  Select2BackButtonModifier.prototype.attach = function() {
    this.$searchContainer.addClass('input-group select2tree');
    this.$searchContainer.prepend(this.$backContainer);
  };

  Select2BackButtonModifier.prototype.detach = function() {
    if (this.$searchContainer.hasClass('select2tree')) {
      this.$searchContainer.removeClass('input-group select2tree');
      this.$backContainer.detach();
    }
  };

  /**
   *
   * @param {!Object} $input
   * @param {!Object} options
   *
   * @constructor
   */
  function Select2Tree($input, options) {
    var self = this;

    /**
     * @type {!Object}
     */
    this.select2 = $input.data('select2');

    self.$titleBlock = self.select2.$selection.find(
        '.select2-selection__rendered');

    self.$useBlock = null;
    if (options.useButtonLabel) {
      self.$useBlock = $('<span class="btn btn-default pull-right select2tree-use_button">' +
          options.useButtonLabel + '</span>');
    }

    ///
    var treeBuilder = new TreeBuilder();
    self.select2.$element.children().each(function(i, option) {
      var $option = $(option);

      treeBuilder.push(
          +$option.attr('value'),
          +$option.attr('parent'),
          $option.text()
      );
    });
    self.tree = treeBuilder.build();

    ///
    self.backButtonModifier = new Select2BackButtonModifier(
        self.select2,
        function() {
          return self.triggerClickBack();
        });

    ///
    $input.on('select2:open', function(e) {
      return self.triggerOpen(e);
    });
    $input.on('select2:selecting', function(e) {
      return self.triggerSelecting(e);
    });
    $input.on('select2:close', function(params) {
      return self.triggerClose(params);
    });

    self.updateState();
  }

  Select2Tree.prototype.getSelectedNode = function() {
    var selectedNodeId = +this.select2.$element.val();
    if (selectedNodeId) {
      return this.tree.get(selectedNodeId);
    }

    return this.tree.getShadowRoot();
  };

  Select2Tree.prototype.updateState = function() {
    var self = this;

    ///
    var selectedNode = self.getSelectedNode();
    var parentNode = selectedNode.getParent();

    /// set title
    var title = getBreadcrumbLabel(selectedNode);
    self.$titleBlock.text(title);
    self.$titleBlock.attr('title', title);

    /// back button
    if (parentNode) {
      self.backButtonModifier.attach();
    } else {
      self.backButtonModifier.detach();
    }

    /// update options list
    // NOTE: there is no event for 'result set is loaded'
    self.select2.$results.hide();
    setTimeout(function() {
      var $resultList = self.select2.$results.find('li');
      $resultList.each(function(i, liOption) {
        var $liOption = $(liOption);
        var liOptionData = $liOption.data('data');
        if (!liOptionData) {
          return;
        }

        var node = self.tree.get(+liOptionData.id);
        if (parentNode !== node.getParent()) {
          $liOption.css('display', 'none');
          $liOption.css('visibility', 'hidden');
          return;
        }

        $liOption.attr('aria-selected', 'false');

        if (node.hasChilds() && !$liOption.hasClass('select2tree-with_child')) {
          $liOption.addClass('select2tree-with_child');

          if (self.$useBlock) {
            $liOption.append(self.$useBlock.clone());
          }
        }

        $liOption.css('display', 'block');
        $liOption.css('visibility', 'visible');
      });

      self.select2.$results.show();
    }, 0);
  };

  Select2Tree.prototype.triggerOpen = function(e) {
    this.updateState();
  };

  Select2Tree.prototype.triggerSelecting = function(e) {
    var node = this.tree.get(+e.params.args.data.id);
    if (!node.hasChilds()) {
      return;
    }

    var $target = $(e.params.args.originalEvent.target);
    if (this.$useBlock && $target.hasClass('select2tree-use_button')) {
      return;
    }

    e.preventDefault();
    this.select2.$element.val(node.getChilds()[0].getId()).trigger('change');
    this.updateState();
  };

  Select2Tree.prototype.triggerClose = function(params) {
    this.backButtonModifier.detach();

    var title = getBreadcrumbLabel(this.getSelectedNode());
    this.$titleBlock.text(title);
    this.$titleBlock.attr('title', title);
  };

  Select2Tree.prototype.triggerClickBack = function() {
    var selectedNode = this.getSelectedNode();

    var first = selectedNode.getParent();
    this.select2.$element.val(first.getId()).trigger('change');
    this.updateState();
  };

  $.fn.select2tree = function(options) {
    options = $.extend({useButtonLabel: ''}, options);

    $(this).each(function() {
      new Select2Tree($(this), options);
    });
  };

})(jQuery);
