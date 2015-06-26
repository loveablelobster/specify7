define([
    'require', 'jquery', 'underscore', 'backbone', 'specifyform', 'templates',
    'savebutton', 'deletebutton', 'assert'
], function(require, $, _, Backbone, specifyform, templates, SaveButton, DeleteButton, assert) {
    "use strict";

    return Backbone.View.extend({
        __name__: "FormTableView",
        events: {
            'click a.specify-edit, a.specify-display': 'edit',
            'click .specify-subview-header a.specify-add-related': 'add'
        },
        initialize: function(options) {
            // options = {
            //   field: specifyfield object?
            //   collection: schema.Model.Collection instance for table
            //   subformNode: subform stub from parent form

            this.field = this.options.field; // TODO: field can be gotten from collection
            assert(this.field.isDependent(), "formtable is only for dependent fields");
            assert(this.collection.field === this.field.getReverse(), "collection doesn't represent field");

            this.title = this.field ? this.field.getLocalizedName() : this.collection.model.specifyModel.getLocalizedName();

            // This is a bit overkill. Especially the change event, but it is cheap way
            // to get collector.agent.*name to update in collecting event subforms. Gag.
            this.collection.on('add remove distroy', this._render, this);
            if (this.field.model.name === 'CollectingEvent' && this.field.name === 'collectors') {
                // TODO: this is really bad. There has to be a better way.
                this.collection.on('change', this._render, this);
            }

            this.readOnly = specifyform.subViewMode(this.$el) === 'view';

            this.populateForm = require('populateform');
        },
        render: function() {
            specifyform.buildSubView(this.$el).done(function(subform) {
                this.subform = subform;
                this._render();
            }.bind(this));
            return this;
        },
        _render: function() {
            var currentRender = this.collection.pluck('cid');
            if (this.lastRender && this.lastRender.length == currentRender.length &&
                _.all(_.zip(this.lastRender, currentRender), function(pair) {
                    return pair[0] == pair[1];
                })) return; // no change

            this.lastRender = currentRender;

            var header = $(templates.subviewheader({
                title: this.title,
                dependent: this.field.isDependent()
            }));

            header.find('.specify-delete-related, .specify-visit-related').remove();
            this.readOnly && header.find('.specify-add-related').remove();
            this.$el.empty().append(header);

            if (this.collection.length < 1) {
                this.$el.append('<p>No Data.</p>');
                return;
            }

            var rows = this.collection.map(function(resource, index) {
                var form = this.subform.clone();
                $('a.specify-' + (this.readOnly ? 'edit' : 'display'), form).remove();
                $('a.specify-edit, a.specify-display', form).data('index', index);
                return this.populateForm(form, resource);
            }, this);

            this.$el.append(rows[0]);
            _(rows).chain().tail().each(function(row) {
                this.$('.specify-view-content-container:first').append($('.specify-view-content:first', row));
            }, this);
        },
        edit: function(evt) {
            evt.preventDefault();
            var index = $(evt.currentTarget).data('index'); // TODO: get the index from the DOM ordering?
            this.buildDialog(this.collection.at(index));
        },
        buildDialog: function(resource) {
            var self = this;
            var mode = self.readOnly ? 'view' : 'edit';
            specifyform.buildViewByName(resource.specifyModel.view, null, mode).done(function(dialogForm) {
                var readOnly = specifyform.getFormMode(dialogForm) === 'view';

                dialogForm.find('.specify-form-header:first').remove();
                var buttons = $('<div class="specify-form-buttons">').appendTo(dialogForm);

                if (readOnly) {
                    // don't add anything.
                } else if (self.field.isDependent()) {
                    $('<input type="button" value="Done">').appendTo(buttons).click(function() {
                        dialog.dialog('close');
                    });
                    $('<input type="button" value="Remove">').appendTo(buttons).click(function() {
                        self.collection.remove(resource);
                        dialog.dialog('close');
                    });
                } else {
                    // TODO: dead code
                    var saveButton = new SaveButton({ model: resource });
                    saveButton.render().$el.appendTo(buttons);
                    saveButton.on('savecomplete', function() {
                        dialog.dialog('close');
                        self.collection.add(resource);
                    });

                    if (!resource.isNew()) {
                        var deleteButton = new DeleteButton({ model: resource });
                        deleteButton.render().$el.appendTo(buttons);
                        deleteButton.on('deleted', function() { dialog.dialog('close'); });
                    }
                }

                self.populateForm(dialogForm, resource);

                var dialog = $('<div>').append(dialogForm).dialog({
                    width: 'auto',
                    title: (resource.isNew() ? "New " : "") + resource.specifyModel.getLocalizedName(),
                    close: function() { $(this).remove(); }
                });
            });
        },
        add: function(evt) {
            var self = this;
            evt.preventDefault();

            var newResource = new (self.collection.model)();
            // Setting the backref here is superfulous because it will be set by parent object
            // when it is saved. Trying to do so now messes things up if the parent object
            // is not yet persisted.
            // if (self.field) {
            //     newResource.set(self.field.otherSideName, self.collection.related.url());
            // }
            self.collection.related && self.collection.add(newResource);

            self.buildDialog(newResource);
        }
    });
});
