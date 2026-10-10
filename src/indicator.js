import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(openPrefs) {
        super._init(0.5, 'AJ-NetUsage');

        const box = new St.BoxLayout({style_class: 'aj-netusage-box'});
        this.add_child(box);
        this._down = this._addField(box, '↓', 'aj-netusage-speed');
        this._up = this._addField(box, '↑', 'aj-netusage-speed');
        this._cpu = this._addField(box, 'CPU', 'aj-netusage-cpu');
        this._ram = this._addField(box, 'RAM', 'aj-netusage-ram');

        // One multi-line label instead of one menu item per row: no rebuilding every tick.
        this._details = new St.Label({text: '…', style_class: 'aj-netusage-details'});
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        item.add_child(this._details);
        this.menu.addMenuItem(item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Preferences', openPrefs);
    }

    // "prefix [   value]": the value sits right-aligned in a fixed-width bin (width set in
    // stylesheet.css), so changing numbers or units never shifts the top bar.
    _addField(box, prefix, widthClass) {
        const field = new St.BoxLayout({style_class: 'aj-netusage-field'});
        field.add_child(new St.Label({text: prefix, y_align: Clutter.ActorAlign.CENTER}));
        const value = new St.Label({
            text: '—',
            style_class: 'aj-netusage-value',
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        field.add_child(new St.Bin({style_class: widthClass, child: value}));
        box.add_child(field);
        return {field, value};
    }

    // cpu / ram: null hides that field.
    setValues(down, up, cpu, ram) {
        for (const [f, text] of [[this._down, down], [this._up, up], [this._cpu, cpu], [this._ram, ram]]) {
            f.field.visible = text !== null;
            if (text !== null && f.value.text !== text)
                f.value.text = text;
        }
    }

    setDetails(text) {
        this._details.text = text;
    }
});
