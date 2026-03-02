import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import DynamicIcon from './DynamicIcon';
import { Search, X } from 'lucide-react';

const COMMON_ICONS = [
    'wallet', 'credit-card', 'banknote', 'coins', 'piggy-bank', 'landmark', 'receipt', 'shopping-cart',
    'shopping-bag', 'utensils', 'coffee', 'bus', 'car', 'plane', 'home', 'zap', 'droplet', 'phone',
    'wifi', 'tv', 'monitor', 'smartphone', 'gift', 'heart', 'star', 'smile', 'user', 'users',
    'briefcase', 'graduation-cap', 'book', 'clapperboard', 'music', 'camera', 'gamepad-2', 'dumbbell',
    'stethoscope', 'pill', 'shield', 'lock', 'key', 'flag', 'bell', 'info', 'help-circle',
    'check-circle', 'alert-circle', 'plus-circle', 'minus-circle', 'arrow-up-right', 'arrow-down-left',
    'trending-up', 'trending-down', 'pie-chart', 'bar-chart-2', 'activity', 'calendar', 'clock',
    'map-pin', 'globe', 'mail', 'send', 'message-square', 'trash-2', 'edit-2', 'settings'
];

const IconPicker = ({ selectedIcon, onSelect, color = 'var(--accent-primary)' }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIcons = COMMON_ICONS.filter(icon =>
        icon.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="icon-picker-container" style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--glass-border)',
            padding: '1rem',
            width: '100%',
            maxHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            <div style={{ position: 'relative' }}>
                <Search size={16} style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                }} />
                <input
                    type="text"
                    placeholder="Tìm biểu tượng..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.5rem 0.5rem 0.5rem 2rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--border-radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                    }}
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
                gap: '0.5rem',
                overflowY: 'auto',
                paddingRight: '4px'
            }}>
                {filteredIcons.map(icon => (
                    <button
                        key={icon}
                        type="button"
                        onClick={() => onSelect(icon)}
                        style={{
                            aspectRatio: '1/1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--border-radius-sm)',
                            border: selectedIcon === icon ? `2px solid ${color}` : '1px solid transparent',
                            background: selectedIcon === icon ? `${color}22` : 'transparent',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}
                        title={icon}
                    >
                        <DynamicIcon
                            name={icon}
                            size={20}
                            color={selectedIcon === icon ? color : 'var(--text-secondary)'}
                        />
                    </button>
                ))}
            </div>

            {filteredIcons.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Không tìm thấy biểu tượng nào.
                </div>
            )}
        </div>
    );
};

export default IconPicker;
