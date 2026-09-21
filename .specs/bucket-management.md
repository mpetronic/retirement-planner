# Role

You are a highly experienced certified financial planner and an experience web application developer.

# Goal

Implement a manangement interface for a 3-bucket (3B) management strategy for the Retirement Planner
application.

# Overview

The 3-bucket strategy is a retirement income strategy that uses three buckets to manage retirement
income.  It is a flexible strategy that can be adapted to different retirement income needs.  It is
also a relatively simple strategy to understand and implement.  It is a good strategy for people who
want a flexible and adaptable retirement income strategy that is relatively simple to understand and
implement.

I want to be able to visualize the 3B stragegy in the UI, as well as being able to edit the
bucket parameters in the UI. I want to be able to visually see how money if flowing from one bucket
to another, define or reconfigure the rules that control these flows and refills, and edit the
parameters of the various buckets.  Use the bucket definitions in 

# Requirements

- It must have its own dedicated workspace in the application
- It must have a separate view for visualizing the buckets and another for editing/defining the
  rules that control the movement of money and the structure of the buckets
- The names of the three buckets should be "Cash", "Income" and "Growth" where the cash bucket is
  for near-term (1-2 yr funding of living expenses and decoupled from market conditions), the income
  bucket is for 3-7 yr horizons that protect money from market conditions but can be a bit more
  invested in the market), and growth bucket is for the 8+ yr horizon where time is available to
  recover from market downturns without needing withdrawls and therfore can be heavily equity invested.
- I should be able to define cash reserve categories in the cash bucket for at least
    - Living expenses
    - Paying taxes on Roth conversions
- I should be able to setup bond ladders in the income bucket
- I should be able to pause rebuilding of the bond ladder when I feel the market is down and do not
  want to sell equities from the income bucket to replenish a ladder rung
- The bucket engine must pull account balances from the main simulation engine including using
  manaully entered real account balances from the past as time progresses or using predicted values
  otherwise.
- There needs to be an intuitive and creative visualization of the three buckets, their balances,
  and their internal stucture that shows the different classes of investments in each bucket. For
  example, in the income bucket, I should, at a glance, be able to see there is 60% equities, 20%
  treasuries, 20% bonds, and there is a bond ladder where each rung contain A, B, C, D, and E
  investments.
  