const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let memoryEvents = [
  { id: 'evt-1', name: 'Diwali Festive Sale', startDate: '2026-10-25', endDate: '2026-11-05', category: 'FESTIVAL', description: '+35% surge in Groceries and Electronics demand', region: 'ALL' },
  { id: 'evt-2', name: 'Q4 Year-End Peak', startDate: '2026-12-15', endDate: '2026-12-31', category: 'PROMOTION', description: '+28% regional hub order volume spike', region: 'ALL' },
  { id: 'evt-3', name: 'Monsoon Seasonal Rebalancing', startDate: '2026-07-01', endDate: '2026-08-31', category: 'SEASONAL', description: '+18% increase in regional inventory buffer requirements', region: 'West' }
];

// GET /api/events
exports.getEvents = async (req, res) => {
  try {
    let events = [];
    try {
      events = await prisma.event.findMany({ orderBy: { startDate: 'asc' } });
    } catch (e) {}

    if (!events || events.length === 0) {
      events = memoryEvents;
    }

    res.json({ success: true, count: events.length, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/events
exports.createEvent = async (req, res) => {
  try {
    const { name, startDate, endDate, category, description, region } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Event name, startDate, and endDate are required' });
    }

    let newEvt = null;
    try {
      newEvt = await prisma.event.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          category: category || 'FESTIVAL',
          description,
          region: region || 'ALL'
        }
      });
    } catch (e) {
      newEvt = {
        id: `evt-${Date.now()}`,
        name,
        startDate,
        endDate,
        category: category || 'FESTIVAL',
        description,
        region: region || 'ALL'
      };
      memoryEvents.push(newEvt);
    }

    res.status(201).json({ success: true, message: 'Seasonal event added', data: newEvt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
