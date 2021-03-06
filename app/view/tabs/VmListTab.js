Ext.define('Onc.view.tabs.VmListTab', {
    extend : 'Ext.grid.Panel',
    alias : 'widget.computevmlisttab',
    requires : ['Ext.ux.grid.FiltersFeature'],
    _cellComponentMap : null, // map of reusable components
    _cellContainerMap : null, // map of containers

    title : "Virtual Machines",
    multiSelect : true,
    header : false,

    cacheComponents : true, // to reuse components or not

    viewConfig : {
        getRowClass : function(record) {
            return 'compute state-' + Onc.model.Compute.calculatedState(record.get("features"), record.get("state"));
        }
    },

    listeners : {
        'boxready' : function(grid) {
            grid.filters.createFilters();
            this.createColumns(grid.headerCt);
            grid.filters.reload();
        }
    },

    /**
     * Adds hidden columns, taken from proxy attrs
     *
     * @param headerCt
     */
    createColumns : function(headerCt) {
        var attrs = this.store.proxy.extraParams['attrs'];
        // For HN vmlist this does not work
        if (attrs) {
            var attrsArr = attrs.split(",");
            var attrsColumns = [];
            for (var i = 0; i < attrsArr.length; i++) {
                var name = attrsArr[i];
                attrsColumns.push({
                    dataIndex : name,
                    text : Ext.String.capitalize(name),
                    filterable : true,
                    hidden : true
                });
            }
            headerCt.add(attrsColumns);
        }
    },
    lockedFilters : function() {
        var f = (Onc.model.AuthenticatedUser.isAdmin()) ? [] : [{
            type : 'string',
            dataIndex : 'features',
            value : 'IVirtualCompute'
        }];
        return f;
    },

    initComponent : function() {
        var filter = Ext.create('feature.filters', {
            local : false,
            autoReload : true,
            filters : this.lockedFilters()
        });
        // Override so it searches from beginning. To make a difference between active/inactive
        Ext.override(Ext.ux.grid.filter.StringFilter, {
            validateRecord : function(record) {
                var val = record.get(this.dataIndex);
                if ( typeof val != 'string') {
                    return (this.getValue().length === 0);
                }
                return val.toLowerCase().indexOf(this.getValue().toLowerCase()) == 0;
            },
        });

        Ext.override(filter, {
            buildQuery : function(filters) {
                var p = {}, i, f, tmp, len = filters.length;
                p['q'] = [];
                if (!this.encode) {
                    for ( i = 0; i < len; i++) {
                        f = filters[i];

                        if (f.data["type"] === "string" && f.data["value"]) {
                            var arrayOfStrings = f.data["value"].toString().split(",");
                            for (var j = 0; j < arrayOfStrings.length; j++)
                                p['q'].push(f.field + ":" + arrayOfStrings[j]);
                        }

                    }
                } else {
                    tmp = [];
                    for ( i = 0; i < len; i++) {
                        f = filters[i];
                        tmp.push(Ext.apply({}, {
                            field : f.field
                        }, f.data));
                    }
                    // only build if there is active filter
                    if (tmp.length > 0) {
                        p[this.paramPrefix] = Ext.JSON.encode(tmp);
                    }
                }
                return p;
            }
        });

        this.addEvents('groupStop', 'groupStart');

        // initialize component and subscription cache
        this._cellComponentMap = {};
        this._cellContainerMap = {};
        if (this.record) {
            filter.local = true;
            // For HN vmlist only local filtering
            this.store = this.record.getChild(this.vmlistConfig.url).children();
            this.store.filterBy(function(record) {
                return Ext.Array.contains(record.get("features"), "IDeployed");
            });

            this.tbar = this._createTbarButtons();
        }
        this.features = [filter];

        this.columns = [{
            header : 'State',
            xtype : 'templatecolumn',
            tpl : new Ext.XTemplate('<div class="state-color" data-qtip="State: {[Onc.model.Compute.calculatedState(values.features,values.state)]}"></div>', '<div class="{[this.getComputeType(values.tags)]}-icon">', '<span data-qtip="{[this.getType(values.tags, false)]}">', '{[this.getType(values.tags, true)]}</span></div>', {
                getComputeType : function(ctype) {
                    return Onc.model.Compute.getComputeType(ctype);
                },
                getType : function(ctype, shortver) {
                    return Onc.model.Compute.getType(ctype, shortver);
                }
            }),
            width : 75,
            dataIndex : 'state'
        }, {
            header : 'Name',
            filterable : true,
            dataIndex : 'hostname',
            width : 100,
            flex : 0,
            editor : {
                xtype : 'textfield',
                allowBlank : false
            }
        }, {
            header : 'Inet4',
            filterable : true,
            dataIndex : 'ipv4_address',
            width : 120,
            editor : {
                xtype : 'textfield',
                allowBlank : true
            },
            renderer : function(value, metaData, record, row, col, store, gridView) {
                if (value.indexOf('0.0.0.0') === 0) {
                    if (Ext.Array.contains(record.get('features'), 'IDeploying'))
                        return 'IP is being allocated...';
                    else if (Ext.Array.contains(record.get('features'), 'IUndeployed'))
                        return 'IP not allocated';
                }
                return value;
            }
        }, {
            header : 'actions',
            width : 165,
            flex : 0,
            filterable : false,
            renderer : makeColumnRenderer(this._computeStateRenderer.bind(this))
        }, this._makeGaugeColumn('CPU usage', 'cpu'), this._makeGaugeColumn('Memory usage', 'memory', 'MB'), this._makeGaugeColumn('Disk usage', 'diskspace', 'MB'), {
            header : 'ID',
            dataIndex : 'id',
            width : 130,
            hidden : true,
            renderer : function(val, metadata, record, rowIndex, colIndex, store) {
                Onc.core.EventBus.fireEvent("computeSuspiciousChanged", record.data['id'], record.data['suspicious']);
                return val;
            }
        }, {
            header : 'Tags',
            filter : {
                active : true,
                type : "string"
            },
            dataIndex : 'tags',
            hidden : true,
            width : 100,
            flex : 0
        }, {
            header : 'Owner',
            hidden : !Onc.model.AuthenticatedUser.isAdmin(),
            dataIndex : 'owner'
        }];

        this.callParent(arguments);
    },

    // Helper methods

    _createTbarButtons : function() {
        var actions = [{
            text : 'Start',
            icon : 'Start',
            handler : function(vms) {
                this.fireEvent('groupStart', vms);
            }.bind(this)
        }, {
            text : 'Shut Down',
            icon : 'Standby',
            handler : function(vms) {
                this.fireEvent('groupStop', vms);
            }.bind(this)
        }];

        var tbarButtons = actions.map( function(action) {
            return {
                icon : 'resources/img/icon/' + action.icon + '16.png',
                listeners : {
                    'click' : function() {
                        var selectedItems = this.getSelectionModel().getSelection();
                        if (selectedItems.length === 0)
                            Ext.Msg.show({
                                title : "Error",
                                msg : "Please select a VM from the list.",
                                buttons : Ext.Msg.OK,
                                icon : Ext.Msg.ERROR
                            });
                        else
                            action.handler(selectedItems);
                    }.bind(this)
                }
            };
        }.bind(this));

        tbarButtons.unshift({
            xtype : 'tbseparator'
        });
        tbarButtons.unshift({
            itemId : 'new-vm-button',
            text : 'New',
            icon : 'resources/img/icon/add.png',
            tooltip : 'Add a new virtual machine'
        }, !Ext.ENABLE_VMLIST_DELETE ? null : {
            itemId : 'delete-vm-button',
            text : 'Delete',
            icon : 'resources/img/icon/delete.png',
            tooltip : 'Delete the selected virtual machines'
        });

        return tbarButtons;
    },

    _computeStateRenderer : function(domId, _, __, vmRec) {
        var csKey = 'computestate-' + vmRec.get('id');
        this._addToContainer(vmRec.get('id'), csKey, domId, function() {
            return Ext.widget('computestatecontrol', {
                compute : vmRec,
                // fixed layout needed because of ExtJs-4.1 rendering mechanism
                defaults : {
                    width : 38,
                    height : 38
                }
            });
        }.bind(this));
    },

    _makeGaugeColumn : function(label, name, unit) {
        return {
            header : label,
            width : 150,
            align : 'center',
            dataIndex : 'id',
            resizable : false,
            filterable : false,
            renderer : makeColumnRenderer( function(domId, _, __, rec) {
                var gaugeKey = 'gauge-' + rec.get('id') + '-' + label;
                this._addToContainer(rec.get('id'), gaugeKey, domId, function() {
                    return this._createGauge(label, name, unit, rec);
                }.bind(this));
            }.bind(this))
        };
    },

    _createGauge : function(label, name, unit, rec) {
        if (name === 'memory')
            return Ext.create('Onc.core.ui.components.MemoryGauge', {
                border : false,
                compute : rec,
                unit : 'MB'
            });
        else if (name === 'cpu')
            return Ext.create('Onc.core.ui.components.CPUGauge', {
                border : false,
                compute : rec
            });
        else if (name === 'diskspace')
            return Ext.create('Onc.core.ui.components.DiskGauge', {
                border : false,
                compute : rec,
                metricsSubscriptionUrl : null,
                unit : 'MB'
            });
    },

    _addToContainer : function(computeId, componentKey, domId, componentFactory) {

        if (this.cacheComponents) {
            // retrieve existing component, or create if one does not exists
            var cellComponent = this._cellComponentMap[componentKey];
            if (!cellComponent) {
                cellComponent = componentFactory();
                this._cellComponentMap[componentKey] = cellComponent;
            } else {
                cellComponent.fireEvent("afterrender");
            }

            // create new container and add component
            var cellContainer = Ext.create('Ext.container.Container', {
                renderTo : domId
            });
            cellContainer.add(cellComponent);

            // destroy previous gauge container
            this._destroyCellContainer(componentKey);

            // memorize current gauge container
            this._cellContainerMap[componentKey] = cellContainer;
        } else {
            // create new container and add component
            var cellContainer = Ext.create('Ext.container.Container', {
                computeIdForDestroying : computeId,
                renderTo : domId
            });
            cellContainer.add(componentFactory());
            return cellContainer;
        }

    },

    // destroys container and component cache
    onDestroy : function() {
        console.log("destroy")
        // containers
        for (var containerKey in this._cellContainerMap) {
            this._destroyCellContainer(containerKey);
        }
        // delete this._cellContainerMap;

        // components
        for (var componentKey in this._cellComponentMap) {
            this._cellComponentMap[componentKey].destroy();
        }
        delete this._cellComponentMap;
    },

    _destroyCellContainer : function(containerKey) {
        var oldGaugeContainer = this._cellContainerMap[containerKey];
        if (oldGaugeContainer) {
            oldGaugeContainer.removeAll();
            oldGaugeContainer.destroy();
            delete oldGaugeContainer;
        }
    }
});
