const ParkingSlot = require('../models/ParkingSlot');
const Reservation = require('../models/Reservation');
const Payment = require('../models/Payment');
const User = require('../models/User');

function buildDateFilters(startDate, endDate) {
  const paymentFilter = {};
  const reservationFilter = {};

  if (startDate || endDate) {
    paymentFilter.createdAt = {};
    reservationFilter.startAt = {};

    if (startDate) {
      const start = new Date(startDate);
      paymentFilter.createdAt.$gte = start;
      reservationFilter.startAt.$gte = start;
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);
      paymentFilter.createdAt.$lt = endDateTime;
      reservationFilter.startAt.$lt = endDateTime;
    }
  }

  return { paymentFilter, reservationFilter };
}

function computePeriodLabel(startDate, endDate) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return 'All time';
}

function scoreSeverity(value, thresholds) {
  if (value >= thresholds.high) return 'high';
  if (value >= thresholds.medium) return 'medium';
  return 'low';
}

function buildSimpleAnswer(question, context) {
  const q = String(question || '').toLowerCase();
  const { occupancyRate, avgRevenuePerReservation, activeReservations, totalReservations, topSlots } = context;

  if (!q.trim()) {
    return 'Please type a question about revenue, occupancy, top slots, or what to improve next.';
  }

  if (q.includes('highest') || q.includes('top slot') || q.includes('most used') || q.includes('busiest')) {
    if (!topSlots?.length) return 'I do not have enough slot history yet to rank the busiest slots.';
    const top = topSlots.slice(0, 3).map((slot) => `${slot.slotNumber} (${slot.reservationCount})`).join(', ');
    return `The busiest slots are ${top}. Focus on these for faster turnaround and monitoring.`;
  }

  if (q.includes('revenue') || q.includes('earning') || q.includes('income') || q.includes('money')) {
    return `Total revenue is Rs ${context.totalRevenue.toFixed(2)}. Average revenue per reservation is Rs ${avgRevenuePerReservation.toFixed(2)}.`;
  }

  if (q.includes('occupancy') || q.includes('full') || q.includes('capacity')) {
    return `Occupancy is ${occupancyRate.toFixed(1)}%. ${activeReservations} reservations are currently active out of ${context.totalSlots} slots.`;
  }

  if (q.includes('improve') || q.includes('next') || q.includes('action') || q.includes('suggest')) {
    if (occupancyRate >= 85) {
      return 'Priority: manage peak demand first. Consider operational alerts, faster slot turnover, and temporary demand controls.';
    }
    if (avgRevenuePerReservation < 10) {
      return 'Priority: improve monetization. Review pricing, time-based offers, and payment completion nudges.';
    }
    return 'Priority: improve repeat usage. Add reminders, loyalty offers, and slot recommendation nudges.';
  }

  if (q.includes('reservation') || q.includes('booking')) {
    return `There are ${totalReservations} reservations in the selected period. Active reservations are ${activeReservations}.`;
  }

  return 'I can answer about revenue, occupancy, busiest slots, reservations, or what action to take next. Try asking: “Which slot is busiest?” or “What should I improve first?”';
}

async function tryGenerateQuestionAnswerWithLlm(question, input) {
  const apiKey = process.env.OPENAI_API_KEY;
  const llmEnabled = process.env.ENABLE_LLM_INSIGHTS === 'true';

  if (!apiKey || !llmEnabled) {
    return null;
  }

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const prompt = [
      'You are a concise parking operations assistant.',
      'Answer the user question using only the given JSON context.',
      'Return strict JSON with fields: answer (string), confidence (number 0-100), followUps (array of 3 strings).',
      'Keep it short, practical, and easy to understand.',
      `Question: ${question}`,
      `Context: ${JSON.stringify(input)}`,
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data?.output_text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed.answer !== 'string') return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

async function tryGenerateNarrativeWithLlm(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  const llmEnabled = process.env.ENABLE_LLM_INSIGHTS === 'true';

  if (!apiKey || !llmEnabled) {
    return null;
  }

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const prompt = [
      'You are an operations analyst for a smart parking system.',
      'Given the metrics JSON, return strict JSON with fields:',
      'headline (string), insights (array of 3 strings), actions (array of 3 objects: title, impact, effort), confidence (number 0-100).',
      'Keep insights practical and concise. No markdown. No extra keys.',
      JSON.stringify(input),
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data?.output_text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.insights) || !Array.isArray(parsed.actions)) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

exports.listSlots = async (req, res, next) => {
  try {
    const slots = await ParkingSlot.find();
    res.json({ slots });
  } catch (err) {
    next(err);
  }
};

exports.createSlot = async (req, res, next) => {
  try {
    const { slotNumber } = req.body;
    const slot = await ParkingSlot.create({ slotNumber });
    res.json({ slot });
  } catch (err) {
    next(err);
  }
};

exports.updateSlot = async (req, res, next) => {
  try {
    const slot = await ParkingSlot.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ slot });
  } catch (err) {
    next(err);
  }
};

exports.getAIInsights = async (req, res, next) => {
  try {
    const { startDate, endDate, question } = req.query;
    const { paymentFilter, reservationFilter } = buildDateFilters(startDate, endDate);
    const now = new Date();

    const [
      totalSlots,
      availableSlots,
      totalReservations,
      activeReservations,
      totalUsers,
      totalRevenueResult,
      dailyRevenue,
      dailyReservations,
      topSlots,
    ] = await Promise.all([
      ParkingSlot.countDocuments(),
      ParkingSlot.countDocuments({ status: 'Available' }),
      Reservation.countDocuments(reservationFilter),
      Reservation.countDocuments({
        ...reservationFilter,
        status: 'Active',
        endAt: { $gt: now },
      }),
      User.countDocuments({ role: 'driver' }),
      Payment.aggregate(
        paymentFilter.createdAt
          ? [
              { $match: paymentFilter },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]
          : [{ $group: { _id: null, total: { $sum: '$amount' } } }]
      ),
      Payment.aggregate([
        ...(paymentFilter.createdAt ? [{ $match: paymentFilter }] : []),
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$amount' },
            payments: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Reservation.aggregate([
        ...(reservationFilter.startAt ? [{ $match: reservationFilter }] : []),
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$startAt' } },
            reservations: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Reservation.aggregate([
        ...(reservationFilter.startAt ? [{ $match: reservationFilter }] : []),
        {
          $group: {
            _id: '$slot',
            reservationCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'parkingslots',
            localField: '_id',
            foreignField: '_id',
            as: 'slotInfo',
          },
        },
        { $unwind: '$slotInfo' },
        {
          $project: {
            slotNumber: '$slotInfo.slotNumber',
            reservationCount: 1,
          },
        },
        { $sort: { reservationCount: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const totalRevenue = totalRevenueResult[0]?.total || 0;
    const occupiedSlots = Math.max(totalSlots - availableSlots, 0);
    const occupancyRate = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;
    const avgRevenuePerReservation = totalReservations > 0 ? totalRevenue / totalReservations : 0;
    const reservationsPerSlot = totalSlots > 0 ? totalReservations / totalSlots : 0;

    const dayMap = new Map();
    dailyRevenue.forEach((row) => {
      dayMap.set(row._id, {
        date: row._id,
        revenue: Number(row.revenue || 0),
        payments: Number(row.payments || 0),
        reservations: 0,
      });
    });

    dailyReservations.forEach((row) => {
      if (!dayMap.has(row._id)) {
        dayMap.set(row._id, {
          date: row._id,
          revenue: 0,
          payments: 0,
          reservations: Number(row.reservations || 0),
        });
        return;
      }

      const existing = dayMap.get(row._id);
      existing.reservations = Number(row.reservations || 0);
      dayMap.set(row._id, existing);
    });

    const dailySeries = Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const revenueValues = dailySeries.map((d) => d.revenue);
    const avgDailyRevenue = revenueValues.length
      ? revenueValues.reduce((sum, value) => sum + value, 0) / revenueValues.length
      : 0;
    const peakDay = dailySeries.reduce(
      (acc, cur) => (cur.revenue > acc.revenue ? cur : acc),
      { date: '-', revenue: 0, reservations: 0 }
    );

    const occupancySeverity = scoreSeverity(occupancyRate, { medium: 70, high: 85 });
    const activeRatio = totalSlots > 0 ? (activeReservations / totalSlots) * 100 : 0;
    const activeSeverity = scoreSeverity(activeRatio, { medium: 55, high: 80 });

    const heuristicInsights = [
      `Occupancy is at ${occupancyRate.toFixed(1)}%, with ${occupiedSlots} of ${totalSlots} slots currently in use.`,
      `Average revenue per reservation is Rs ${avgRevenuePerReservation.toFixed(2)} across ${totalReservations} reservations.`,
      peakDay.date !== '-'
        ? `Peak daily revenue was Rs ${peakDay.revenue.toFixed(2)} on ${peakDay.date}.`
        : 'No daily revenue trend yet for the selected period.',
    ];

    const alerts = [
      {
        type: 'Occupancy pressure',
        severity: occupancySeverity,
        detail:
          occupancySeverity === 'high'
            ? 'Parking demand is high. Consider temporary surge pricing or adding buffer slots.'
            : occupancySeverity === 'medium'
            ? 'Steady demand observed. Monitor evening windows for bottlenecks.'
            : 'Healthy occupancy with room for additional reservations.',
      },
      {
        type: 'Live load',
        severity: activeSeverity,
        detail:
          activeSeverity === 'high'
            ? 'Current active reservations are near operational limits.'
            : activeSeverity === 'medium'
            ? 'Moderate active load. Keep validation counters staffed.'
            : 'Active load is low and manageable.',
      },
    ];

    const actions = [
      {
        title: 'Prioritize top-demand slots',
        impact: 'high',
        effort: 'low',
        detail: topSlots.length
          ? `Review slots ${topSlots
              .slice(0, 3)
              .map((s) => s.slotNumber)
              .join(', ')} for faster turnaround and queue handling.`
          : 'No slot trend available yet. Collect at least 1 day of booking data.',
      },
      {
        title: 'Tune pricing around high demand windows',
        impact: 'medium',
        effort: 'medium',
        detail:
          avgDailyRevenue > 0
            ? `Use average daily revenue of Rs ${avgDailyRevenue.toFixed(2)} as baseline for pricing experiments.`
            : 'Start with fixed pricing until enough revenue trend is available.',
      },
      {
        title: 'Increase repeat conversion',
        impact: 'medium',
        effort: 'low',
        detail: `Target ${Math.max(totalUsers, 1)} registered users with reminder campaigns and loyalty coupons.`,
      },
    ];

    const llmPayload = await tryGenerateNarrativeWithLlm({
      totalSlots,
      availableSlots,
      activeReservations,
      totalReservations,
      totalRevenue,
      totalUsers,
      occupancyRate,
      avgRevenuePerReservation,
      period: computePeriodLabel(startDate, endDate),
      topSlots,
      dailySeries,
    });

    const occupancyBands = {
      low: Math.max(0, 100 - Math.round(occupancyRate) - 20),
      medium: Math.min(35, Math.round(occupancyRate * 0.5)),
      high: Math.min(100, Math.round(occupancyRate)),
    };

    const questionContext = {
      totalSlots,
      availableSlots,
      occupiedSlots,
      activeReservations,
      totalReservations,
      totalRevenue,
      totalUsers,
      occupancyRate,
      avgRevenuePerReservation,
      topSlots,
    };

    const llmQuestionPayload = question
      ? await tryGenerateQuestionAnswerWithLlm(question, {
          ...questionContext,
          period: computePeriodLabel(startDate, endDate),
          dailySeries,
        })
      : null;

    const simpleAnswer = question
      ? buildSimpleAnswer(question, questionContext)
      : '';

    res.json({
      summary: {
        headline:
          llmPayload?.headline ||
          `Parking intelligence for ${computePeriodLabel(startDate, endDate)}`,
        confidence: Math.max(
          55,
          Math.min(98, llmPayload?.confidence || Math.round(75 + occupancyRate / 10))
        ),
        period: computePeriodLabel(startDate, endDate),
      },
      kpis: [
        {
          label: 'Occupancy Rate',
          value: `${occupancyRate.toFixed(1)}%`,
          status: occupancySeverity,
          trend: reservationsPerSlot.toFixed(2),
          trendLabel: 'Reservations per slot',
        },
        {
          label: 'Avg Revenue / Reservation',
          value: `Rs ${avgRevenuePerReservation.toFixed(2)}`,
          status: avgRevenuePerReservation >= 20 ? 'high' : avgRevenuePerReservation >= 10 ? 'medium' : 'low',
          trend: avgDailyRevenue.toFixed(2),
          trendLabel: 'Avg daily revenue',
        },
        {
          label: 'Active Load',
          value: `${activeReservations}`,
          status: activeSeverity,
          trend: `${activeRatio.toFixed(1)}%`,
          trendLabel: 'Active vs total slots',
        },
      ],
      insights: llmPayload?.insights?.slice(0, 3) || heuristicInsights,
      alerts,
      actions: llmPayload?.actions?.slice(0, 3) || actions,
      question: question
        ? {
            asked: question,
            answer: llmQuestionPayload?.answer || simpleAnswer,
            confidence: Math.max(
              50,
              Math.min(98, llmQuestionPayload?.confidence || Math.round(70 + occupancyRate / 10))
            ),
            followUps: llmQuestionPayload?.followUps || [
              'Which slot is busiest?',
              'What should I improve first?',
              'How is revenue performing?',
            ],
            source: llmQuestionPayload ? 'llm' : 'heuristic',
          }
        : null,
      dailySeries,
      topSlots,
      occupancyBands,
      meta: {
        source: llmPayload ? 'llm' : 'heuristic',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.generateReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        dateFilter.createdAt.$lt = endDateTime;
      }
    }

    // Build reservation date filter
    let reservationDateFilter = {};
    if (startDate || endDate) {
      reservationDateFilter.startAt = {};
      if (startDate) {
        reservationDateFilter.startAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        reservationDateFilter.startAt.$lt = endDateTime;
      }
    }

    // Total slots (not date dependent)
    const totalSlots = await ParkingSlot.countDocuments();
    const availableSlots = await ParkingSlot.countDocuments({ status: 'Available' });
    const occupiedSlots = await ParkingSlot.countDocuments({ status: 'Occupied' });
    
    // Active reservations with date filter
    const now = new Date();
    const activeReservationsFilter = {
      status: 'Active',
      endAt: { $gt: now },
      ...reservationDateFilter
    };
    const activeReservations = await Reservation.countDocuments(activeReservationsFilter);
    
    // Total reservations with date filter
    const totalReservations = await Reservation.countDocuments(reservationDateFilter);
    
    // Total payments with date filter
    const totalPayments = await Payment.countDocuments(dateFilter);
    
    // Total users (not date dependent)
    const totalUsers = await User.countDocuments({ role: 'driver' });
    
    // Revenue with date filter
    const revenueFilter = dateFilter.createdAt ? [
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ] : [
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ];
    
    const revenueResult = await Payment.aggregate(revenueFilter);

    // Slot utilization with date filter
    const slotUtilization = await Reservation.aggregate([
      { $match: reservationDateFilter },
      {
        $group: {
          _id: '$slot',
          reservationCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'parkingslots',
          localField: '_id',
          foreignField: '_id',
          as: 'slotInfo'
        }
      },
      { $unwind: '$slotInfo' },
      {
        $project: {
          slotNumber: '$slotInfo.slotNumber',
          reservationCount: 1
        }
      },
      { $sort: { reservationCount: -1 } },
      { $limit: 10 }
    ]);

    // Recent reservations with date filter
    const recentReservations = await Reservation.find(reservationDateFilter)
      .populate('slot', 'slotNumber')
      .populate('vehicle', 'number')
      .populate('user', 'name email')
      .sort({ startAt: -1 })
      .limit(20);

    res.json({
      totalSlots,
      availableSlots,
      occupiedSlots,
      activeReservations,
      totalReservations,
      totalPayments,
      totalRevenue: revenueResult[0]?.total || 0,
      totalUsers,
      slotUtilization,
      recentReservations,
    });
  } catch (err) {
    next(err);
  }
};

// Validate ticket/reservation
exports.validateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format before querying
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('Invalid ObjectId format:', id);
      return res.status(400).json({ 
        error: 'Invalid reservation ID format',
        details: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }
    
    const reservation = await Reservation.findById(id)
      .populate('vehicle')
      .populate('slot')
      .populate('user', 'name email');

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json({ reservation });
  } catch (err) {
    console.error('Validate ticket error:', err.message);
    next(err);
  }
};

// Get all payments with details
exports.listPayments = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        dateFilter.createdAt.$lt = endDateTime;
      }
    }

    const payments = await Payment.find(dateFilter)
      .populate('user', 'name email')
      .populate('reservation')
      .sort({ createdAt: -1 });

    res.json({ payments });
  } catch (err) {
    console.error('List payments error:', err.message);
    next(err);
  }
};

// Get all reservations with details
exports.listReservations = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();
    
    // First, update any expired reservations to Completed status
    await Reservation.updateMany(
      { 
        status: 'Active',
        endAt: { $lt: now }
      },
      { 
        $set: { status: 'Completed' }
      }
    );
    
    // Build date filter for reservations
    let reservationDateFilter = {
      status: 'Active',
      endAt: { $gt: now } // Only show reservations where end time is in the future
    };
    
    if (startDate || endDate) {
      reservationDateFilter.startAt = {};
      if (startDate) {
        reservationDateFilter.startAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        reservationDateFilter.startAt.$lt = endDateTime;
      }
    }
    
    // Then fetch only truly active reservations
    const reservations = await Reservation.find(reservationDateFilter)
      .populate('user', 'name email')
      .populate('vehicle')
      .populate('slot')
      .sort({ startAt: 1 });

    res.json({ reservations });
  } catch (err) {
    console.error('List reservations error:', err.message);
    next(err);
  }
};
