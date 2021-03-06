Ext.define('Onc.view.tabs.VmListGridTab', {
    extend: 'Onc.view.tabs.Tab',
    alias: 'widget.computevmlistgridtab',

    layout: 'fit',
    closable: true,

	isFirstLoad: true, 

    initComponent: function() {
        this.items = [{
            xtype: 'computevmlisttab',
            id: 'vmgrid',
            cacheComponents: false,
            store: "VmGridStore",
            tbar: [{
                xtype: 'button',
                iconCls: 'x-tbar-loading',
                handler: function() {
                    var grid = Ext.getCmp("vmgrid");
                    grid.filters.reload();
                }
            }, {
                text: 'Only running',
                tooltip: 'Show only running',
                enableToggle: true,
                hidden: !Ext.ENABLE_LOCAL_FILTER,
                handler: function(button, state) {
                    var onlyRunning = (button.pressed !== false);
                    var grid = Ext.getCmp("vmgrid");
                    var gridFilter = grid.filters.getFilter("tags");

                    if (onlyRunning) gridFilter.setValue("state:active");
                    gridFilter.setActive(onlyRunning, true);
                    grid.filters.reload();
                }
            }, {
                id: 'vm_grid_type',
                name: 'vm_grid_type',
                hidden: !Onc.model.AuthenticatedUser.isAdmin(),
                isFormField: false,
                xtype: 'combo',
                mode: 'local',
                triggerAction: 'all',
                forceSelection: true,
                editable: false,
                displayField: 'name',
                valueField: 'id',
                queryMode: 'local',
                store: Ext.getStore("VmGridTypeStore").load(),
                listeners: {

                    change: function(combo, newValue, oldValue, eOpts) {
                    	var store = Ext.getStore("VmGridStore");
                        var id = newValue;
                        // hide columns if type is hangar
                        var grid = Ext.getCmp("vmgrid");
                        var showIfCompute = []; // Array of col names, to display only for computes not hangar vms
                        var isCompute = (id == "computes");
                        grid.columns.forEach(function(col) {
                            if (showIfCompute.contains(col.text)) {
                                col.setVisible(isCompute);
                            }
                        });

                        var type = Ext.getStore('VmGridTypeStore').getById(id);
                        store.proxy.url = type.get("url");
                        
                        if(this.isFirstLoad)
                        	this.isFirstLoad = false;
                        else  
                        	store.load();
                        	
                    }.bind(this),

                    afterrender: function(combo, eOpts) {
                        var id = 'computes';
                        combo.select(id);
                    }.bind(this)
                }

            }, ],
            dockedItems: [Ext.create('Ext.toolbar.Paging', {
                dock: 'bottom',
                store: "VmGridStore",
                items:[ {
                    dock: 'bottom',
                    text: 'Clear filters',
                    handler: function() {
                        var grid = Ext.getCmp("vmgrid");
                        // Remove all filters to apply "default" filters
                        grid.filters.removeAll();
                        grid.filters.addFilters(grid.lockedFilters());
                      	grid.filters.createFilters();
                        grid.filters.reload();
                    }
                }],
	            listeners: {
	                afterrender: function() {
	                    this.child('#refresh').hide();
	                }
                }
            })],

        }];

        this.callParent(arguments);
    }

});
