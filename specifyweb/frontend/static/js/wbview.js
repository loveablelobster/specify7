define([
    'jquery', 'underscore', 'backbone', 'whenall',
    'require', 'icons', 'specifyapi', 'schema',
    'text!resources/specify_workbench_upload_def.xml!noinline',
    'jquery-ui', 'datatables'
], function($, _, Backbone, whenAll, require, icons, api, schema, wbupdef) {
    "use strict";

    var wbUploadDef = $.parseXML(wbupdef.toLowerCase());

    function getField(mapping) {
        var tableName = mapping.get('tablename').toLowerCase();
        var fieldName = mapping.get('fieldname').toLowerCase();
        var updef = $('field[table="' + tableName + '"][name="' + fieldName + '"]', wbUploadDef);
        if (updef.length == 1) {
            tableName = updef.attr('actualtable') || tableName;
            fieldName = updef.attr('actualname') || fieldName;
        }
        var model = schema.getModel(tableName);
        return model.getField(fieldName);
    }

    function getPickListItems(field) {
        var picklistName = field && field._localization.picklistname;
        return picklistName &&
            api.getPickListByName(picklistName).pipe(function(pl) {
                return (pl.get('type') == 0) && pl.rget('picklistitems').pipe(function(plItems) {
                    return plItems.fetch({ limit: 0 }).pipe(function() { return plItems.models; });
                });
            });
    }

    function makeHeaders(mappings) {
        return _.invoke(mappings, 'get', 'caption');
    }

    function makeColumns(picklists) {
        return _.map(picklists, function(picklist, i) {
            var col = {data: i + 1};
            picklist && _(col).extend({
                type: 'autocomplete',
                source: _.invoke(picklist, 'get', 'title')
            });
            return col;
        });
    }

    return Backbone.View.extend({
        __name__: "WbForm",
        className: "wbs-form",
        events: {
            'click .wb-save': 'save',
            'click .wb-load': 'load'
        },
        initialize: function(options) {
            this.wbid = options.wbid;
            this.data = options.data;
        },
        getMappings: function() {
            var maps = new schema.models.WorkbenchTemplateMappingItem.LazyCollection({
                filters: { workbenchtemplate: this.wbid, orderby: 'vieworder' }
            });
            return maps.fetch({ limit: 0 }).pipe(function() { return maps.models; });
        },
        render: function() {
            var mappings = this.getMappings();
            var fields = mappings.pipe(function(mappings) { return whenAll(_.map(mappings, getField)); });
            var picklists = fields.pipe(function(fields) { return whenAll(_.map(fields, getPickListItems)); });
            var colHeaders = mappings.pipe(makeHeaders);
            var columns = picklists.pipe(makeColumns);

            $('<button class="wb-save">Save</button>').appendTo(this.el);
            $('<button class="wb-load">Reload</button>').appendTo(this.el);
            var spreadsheet = $('<div>').appendTo(this.el);

            $.when(colHeaders, columns).done(function (colHeaders, columns) {
                this.hot = new Handsontable(spreadsheet[0], {
                    data: this.data,
                    colHeaders: colHeaders,
                    columns: columns,
                    minSpareRows: 1,
                    rowHeaders: true,
                    manualColumnResize: true,
                    columnSorting: true,
                    sortIndicator: true,
                    contextMenu: true
                });
            }.bind(this));

            return this;
        },
        load: function() {
            var dialog = $('<div>Loading...</div>').dialog({
                title: 'Loading',
                modal: true,
                close: function() {$(this).remove();}
            });
            $.get('/api/workbench/rows/' + this.wbid + '/').done(function(data) {
                this.data = data;
                this.hot.loadData(data);
                dialog.dialog('close');
            }.bind(this));
        },
        save: function() {
            var dialog = $('<div>Saving...</div>').dialog({
                title: 'Saving',
                modal: true,
                close: function() {$(this).remove();}
            });
            $.ajax('/api/workbench/rows/' + this.wbid + '/', {
                data: JSON.stringify(this.hot.getData()),
                type: "PUT"
            }).done(function(data) {
                this.data = data;
                this.hot.loadData(data);
                dialog.dialog('close');
            }.bind(this));
        }
    });
});
