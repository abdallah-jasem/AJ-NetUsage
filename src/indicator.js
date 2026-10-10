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
        this._down = this._addField(box, '↓', '99.9 MB/s');
        this._up = this._addField(box, '↑', '99.9 MB/s');
        this._cpu = this._addField(box, 'CPU', '100%');
        this._ram = this._addField(box, 'RAM', '99.9 GB');

        // One multi-line label instead of one menu item per row: no rebuilding every tick.
        this._details = new St.Label({text: '…', style_class: 'aj-netusage-details'});
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        item.add_child(this._details);
        this.menu.addMenuItem(item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Preferences', openPrefs);
    }

    // "prefix value   ": the value sits right after its prefix, in a bin exactly as wide as
    // the widest text it can show (measured in the real panel font, so no guessed widths).
    // Changing numbers or units never shifts the rest of the top bar.
    _addField(box, prefix, widest) {
        const field = new St.BoxLayout({style_class: 'aj-netusage-field'});
        field.add_child(new St.Label({text: prefix, y_align: Clutter.ActorAlign.CENTER}));
        const value = new St.Label({
            text: '—',
            style_class: 'aj-netusage-value',
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const bin = new St.Bin({child: value});
        // style-changed fires once the panel font is applied (and again if the theme changes).
        value.connect('style-changed', () => {
            const text = value.text;
            value.text = widest;
            bin.width = value.get_preferred_width(-1)[1]; // sets min and natural width
            value.text = text;
        });
        field.add_child(bin);
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
